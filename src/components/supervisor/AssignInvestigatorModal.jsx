import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { toast } from 'react-toastify';
import './AssignInvestigatorModal.css';

const AssignInvestigatorModal = ({ claim, onClose, onAssigned }) => {
    const [investigators, setInvestigators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();
    const { socket } = useSocket();
    const [onlineUsers, setOnlineUsers] = useState(new Map());

    useEffect(() => {
        fetchInvestigators();

        if (socket) {
            // Listen for initial online users list
            socket.on('online_users', (users) => {
                const usersMap = new Map();
                users.forEach(user => {
                    usersMap.set(user.userId, user);
                });
                setOnlineUsers(usersMap);
            });

            // Listen for user status changes
            socket.on('user_status_change', ({ userId, isOnline, role, timestamp }) => {
                setOnlineUsers(prev => {
                    const newMap = new Map(prev);
                    newMap.set(userId, { userId, isOnline, role, timestamp });
                    return newMap;
                });
            });

            // Clean up listeners on unmount
            return () => {
                socket.off('online_users');
                socket.off('user_status_change');
            };
        }
    }, [socket]);

    const fetchInvestigators = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users?role=INVESTIGATOR`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch investigators');
            }

            const data = await response.json();
            setInvestigators(data);
        } catch (error) {
            console.error('Fetch error:', error);
            setError(error.message);
            toast.error('Error fetching investigators');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (investigatorId) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/${claim.ClaimId}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({ investigatorId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to assign investigator');
            }

            toast.success('Investigator assigned successfully');
            onAssigned && onAssigned();
            onClose();
        } catch (error) {
            console.error('Assignment error:', error);
            toast.error(error.message || 'Error assigning investigator');
        }
    };

    const isUserOnline = (userId) => {
        const user = onlineUsers.get(userId);
        return user?.isOnline || false;
    };

    const getLastActiveTime = (userId) => {
        const user = onlineUsers.get(userId);
        if (!user) return null;
        return new Date(user.timestamp);
    };

    const formatLastActive = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);

        if (minutes < 1) return 'just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    };

    if (loading) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="loading-spinner"></div>
                        <p>Loading investigators...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <h2>Error</h2>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <p className="error-message">{error}</p>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Close</button>
                        <button className="btn btn-primary" onClick={fetchInvestigators}>Retry</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Assign Investigator</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                
                <div className="modal-body">
                    {investigators.length === 0 ? (
                        <div className="no-investigators">
                            No investigators available
                        </div>
                    ) : (
                        <div className="investigators-list">
                            {investigators.map(investigator => (
                                <div key={investigator.id} className="investigator-item">
                                    <div className="investigator-info">
                                        <div className="investigator-name">{investigator.name}</div>
                                        <div className="investigator-email">{investigator.email}</div>
                                        <div className="investigator-status">
                                            <span className={`status-indicator ${isUserOnline(investigator.id) ? 'status-online' : 'status-offline'}`}></span>
                                            {isUserOnline(investigator.id) ? 'Online' : 'Offline'}
                                            {!isUserOnline(investigator.id) && getLastActiveTime(investigator.id) && (
                                                <span className="last-active"> - Last active {formatLastActive(getLastActiveTime(investigator.id))}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        className="btn btn-primary"
                                        onClick={() => handleAssign(investigator.id)}
                                    >
                                        Assign
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default AssignInvestigatorModal;
