import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaEye, FaPlay, FaSpinner, FaExclamationCircle, FaCalendarAlt, FaUser, FaCircle } from 'react-icons/fa';
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
    const [currentClaimData, setCurrentClaimData] = useState(null);

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
                setCurrentClaimData(null);
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

        const claimId = claim?.claimId;
        console.log('Resolved claimId:', claimId);

        if (!claim || !claimId) {
            console.error('Invalid claim data:', claim);
            toast.error('Invalid claim data');
            return;
        }

        setCurrentClaimData(claim);

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
            setCurrentClaimData(null);
        });

        socket.once('investigation_call_rejected', (data) => {
            console.log('Call rejected:', data);
            toast.error(data.reason || 'Call rejected by supervisor');
            setActiveCall(null);
            setCurrentClaimData(null);
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

    if (showVideoCall && activeCall && currentClaimData) {
        console.log('Rendering video call interface');
        const claimNumber = currentClaimData.claimId ? `CLM-${currentClaimData.claimId}` : `CLAIM-${currentClaimData.claimId}`;
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
        <div className="inube-claims-container">
            <div className="claims-header">
                <h1>iNube Claims</h1>
                <div className="user-profile">
                    <FaUser />
                </div>
            </div>

            <div className="claims-stats">
                <div className="stat-card">
                    <div className="stat-label">Total Claims</div>
                    <div className="stat-value">{claims.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Pending</div>
                    <div className="stat-value">{pendingClaims.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">In Progress</div>
                    <div className="stat-value">{inProgressClaims.length}</div>
                </div>
            </div>

            <div className="claims-grid">
                {claims.length === 0 ? (
                    <div className="no-claims">
                        <p>No claims assigned yet</p>
                    </div>
                ) : (
                    claims.map((claim) => {
                        const supervisorOnline = claim.supervisor ? 
                            isUserOnline(claim.supervisor.id) || claim.supervisor.isOnline : 
                            false;
                        
                        // Format the date to match UI
                        const formattedDate = claim.assignedAt ? 
                            new Date(claim.assignedAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            }).replace(/\//g, '/') : 'N/A';
                        
                        return (
                            <div key={claim.claimId} className="claim-card">
                                <div className="claim-header">
                                    <div className="claim-title">
                                        Claim #{claim.claimId}
                                    </div>
                                    <div className="claim-status">
                                        {claim.status}
                                    </div>
                                </div>
                                
                                <div className="claim-details">
                                    <div className="detail-row">
                                        <FaCalendarAlt className="detail-icon" />
                                        <div className="detail-label">Assigned Date</div>
                                        <div className="detail-value">{formattedDate}</div>
                                    </div>

                                    <div className="detail-row">
                                        <FaUser className="detail-icon" />
                                        <div className="detail-label">Supervisor</div>
                                        <div className="detail-value supervisor-name">
                                            <div className="supervisor-info">
                                                <FaCircle className={`status-dot ${supervisorOnline ? 'online' : 'offline'}`} />
                                                <span>{claim.supervisor?.name || 'Supervisor User'}</span>
                                            </div>
                                            <div className="supervisor-status">
                                                {supervisorOnline ? 'Online' : 'Offline'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="claim-actions">
                                    <button
                                        className="action-btn view"
                                        onClick={() => navigate(`/claims/${claim.claimId}`)}
                                    >
                                        <FaEye /> View Details
                                    </button>
                                    <button
    className={`action-btn start ${!supervisorOnline ? 'disabled' : ''}`}
    onClick={() => supervisorOnline && handleStartInvestigation(claim)}
    disabled={!supervisorOnline || activeCall !== null}
>
    <FaPlay />
    {supervisorOnline ? 'Start Investigation' : 'Supervisor Offline'}
</button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="bottom-navigation">
                <div className="nav-item active">
                    <div className="icon-container">
                        <FaSpinner className="nav-icon" />
                    </div>
                    <div className="nav-label">Assigned Claims</div>
                </div>
                <div className="nav-item">
                    <div className="icon-container">
                        <FaSpinner className="nav-icon" />
                    </div>
                    <div className="nav-label">Active Investigation</div>
                </div>
            </div>
        </div>
    );
};

export default AssignedClaims;