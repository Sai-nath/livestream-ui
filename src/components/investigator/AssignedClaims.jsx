import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaCar, FaMapMarkerAlt, FaCalendarAlt, FaFileAlt, FaPlay, FaEye, FaSpinner, FaExclamationCircle } from 'react-icons/fa';
import { useSocket } from '../../contexts/SocketContext';
import VideoCall from '../common/VideoCall';
import './AssignedClaims.css';

const AssignedClaims = ({ onlineUsers, isUserOnline }) => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const [activeCall, setActiveCall] = useState(null);
    const [showVideoCall, setShowVideoCall] = useState(false);
    const [currentClaimId, setCurrentClaimId] = useState(null);

    useEffect(() => {
        fetchAssignedClaims();

        // Setup socket listeners for video call
        if (socket) {
            console.log('Setting up socket listeners for investigator');
            
            socket.on('investigation_call_accepted', (data) => {
                console.log('Call accepted event received:', data);
                setShowVideoCall(true);
            });

            socket.on('call_ended', () => {
                console.log('Call ended event received');
                setShowVideoCall(false);
                setActiveCall(null);
                setCurrentClaimId(null);
            });

            return () => {
                console.log('Cleaning up socket listeners');
                socket.off('investigation_call_accepted');
                socket.off('call_ended');
            };
        }
    }, [socket]);

    const handleStartInvestigation = async (claim) => {
        console.log('Starting investigation with claim:', claim);

        if (!socket) {
            toast.error('No connection to server');
            return;
        }

        // Check for all possible claim ID fields
        const claimId = claim?.ClaimId || claim?.claimId || claim?.id;
        console.log('Resolved claimId:', claimId);

        if (!claim || !claimId) {
            console.error('Invalid claim data:', claim);
            toast.error('Invalid claim data');
            return;
        }

        setCurrentClaimId(claimId);

        // Request call with supervisor
        socket.emit('investigation_call_request', { 
            claimId: parseInt(claimId, 10)
        });

        // Listen for responses
        socket.once('call_requesting', (data) => {
            console.log('Call requesting:', data);
            toast.info('Calling supervisor...');
            setActiveCall(data.callId);
        });

        socket.once('call_error', (data) => {
            console.error('Call error:', data);
            toast.error(data.message);
            setActiveCall(null);
            setCurrentClaimId(null);
        });

        socket.once('investigation_call_rejected', (data) => {
            console.log('Call rejected:', data);
            toast.error(data.reason || 'Call rejected by supervisor');
            setActiveCall(null);
            setCurrentClaimId(null);
        });
    };

    const handleEndCall = () => {
        console.log('Ending call, activeCall:', activeCall, 'currentClaimId:', currentClaimId);
        if (socket && activeCall) {
            socket.emit('end_call', { callId: activeCall });
            
            if (currentClaimId) {
                socket.emit('update_claim_status', {
                    claimId: parseInt(currentClaimId, 10),
                    status: 'Assigned'
                });
            }
        }
        setShowVideoCall(false);
        setActiveCall(null);
        setCurrentClaimId(null);
    };

    // Debug logging for state changes
    useEffect(() => {
        console.log('State changed - showVideoCall:', showVideoCall, 'activeCall:', activeCall);
    }, [showVideoCall, activeCall]);

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

            const data = await response.json();
            console.log('Fetched claims:', data);
            setClaims(data);
        } catch (error) {
            console.error('Fetch error:', error);
            setError(error.message);
            toast.error(error.message || 'Error fetching assigned claims');
        } finally {
            setLoading(false);
        }
    };

    if (showVideoCall && activeCall) {
        console.log('Rendering video call interface');
        return (
            <div className="video-call-fullscreen">
                <VideoCall
                    role="investigator"
                    callId={activeCall}
                    socket={socket}
                    onEndCall={handleEndCall}
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="loading-container">
                <FaSpinner className="loading-spinner" />
                <p>Loading assigned claims...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <FaExclamationCircle className="error-icon" />
                <p className="error-message">{error}</p>
                <button className="retry-button" onClick={fetchAssignedClaims}>
                    Retry
                </button>
            </div>
        );
    }

    const pendingClaims = claims.filter(claim => claim.status === 'Assigned');
    const inProgressClaims = claims.filter(claim => claim.status === 'In Progress');

    return (
        <div className="assigned-claims-container">
            <div className="header">
                <h2>Assigned Claims</h2>
                <div className="stats">
                    <div className="stat-item">
                        <span className="stat-label">Total Claims</span>
                        <span className="stat-value">{claims.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Pending</span>
                        <span className="stat-value">{pendingClaims.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">In Progress</span>
                        <span className="stat-value">{inProgressClaims.length}</span>
                    </div>
                </div>
            </div>

            <div className="claims-grid">
                {claims.length === 0 ? (
                    <div className="no-claims">
                        <FaFileAlt className="icon" />
                        <p>No claims assigned yet</p>
                    </div>
                ) : (
                    claims.map((claim) => {
                        const supervisorOnline = isUserOnline(claim.supervisor?.id);
                        const claimId = claim?.ClaimId || claim?.claimId || claim?.id;
                        return (
                            <div key={claimId} className="claim-card">
                                <div className="claim-header">
                                    <div className="claim-id">{claimId}</div>
                                    <div className={`claim-status status-${claim.status.toLowerCase().replace(' ', '-')}`}>
                                        {claim.status}
                                    </div>
                                </div>
                                
                                <div className="claim-details">
                                    <div className="detail-item">
                                        <FaCar className="icon" />
                                        <div className="detail-content">
                                            <span className="label">Vehicle</span>
                                            <span className="value">
                                                {claim.vehicleInfo.make} {claim.vehicleInfo.model} ({claim.vehicleInfo.year})
                                            </span>
                                            <span className="sub-value">
                                                Reg: {claim.vehicleInfo.registrationNumber}
                                            </span>
                                        </div>
                                    </div>

                                    {claim.claimDetails.dateOfIncident && (
                                        <div className="detail-item">
                                            <FaCalendarAlt className="icon" />
                                            <div className="detail-content">
                                                <span className="label">Incident Date</span>
                                                <span className="value">
                                                    {new Date(claim.claimDetails.dateOfIncident).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {claim.claimDetails.location && (
                                        <div className="detail-item">
                                            <FaMapMarkerAlt className="icon" />
                                            <div className="detail-content">
                                                <span className="label">Location</span>
                                                <span className="value">{claim.claimDetails.location}</span>
                                            </div>
                                        </div>
                                    )}

                                    {claim.status === 'Assigned' && (
                                        <div className="supervisor-status">
                                            <div className={`status-indicator ${supervisorOnline ? 'online' : 'offline'}`} />
                                            <div className="supervisor-info">
                                                <span className="label">Supervisor:</span>
                                                <span className="value">{claim.supervisor?.name}</span>
                                                <span className="status">
                                                    {supervisorOnline ? 'Online' : 'Offline'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="claim-actions">
                                    <button
                                        className="action-btn view"
                                        onClick={() => navigate(`/claims/${claimId}`)}
                                    >
                                        <FaEye /> View Details
                                    </button>
                                    
                                    {claim.status === 'Assigned' && (
                                        <button
                                            className={`action-btn start ${!supervisorOnline ? 'disabled' : ''}`}
                                            onClick={() => supervisorOnline && handleStartInvestigation(claim)}
                                            disabled={!supervisorOnline || activeCall !== null}
                                            title={
                                                !supervisorOnline 
                                                    ? 'Supervisor must be online to start investigation' 
                                                    : activeCall !== null 
                                                        ? 'Call in progress...'
                                                        : 'Start Investigation'
                                            }
                                        >
                                            <FaPlay /> 
                                            {activeCall !== null 
                                                ? 'Calling...' 
                                                : supervisorOnline 
                                                    ? 'Start Investigation' 
                                                    : 'Waiting for Supervisor'
                                            }
                                        </button>
                                    )}
                                    
                                    {claim.status === 'In Progress' && claim.investigationId && (
                                        <button
                                            className="action-btn continue"
                                            onClick={() => navigate(`/investigation/${claim.investigationId}`)}
                                        >
                                            <FaSpinner /> Continue Investigation
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AssignedClaims;
