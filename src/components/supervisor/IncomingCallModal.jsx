import React, { useEffect, useRef } from 'react';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { createRingtone } from '../../utils/ringtone';
import './IncomingCallModal.css';

const IncomingCallModal = ({ call, onAccept, onReject, onClose, socket }) => {
    const ringtoneRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!socket) {
            console.error('Socket is not available');
            return;
        }

        // Create and play ringtone
        const playRingtone = () => {
            if (ringtoneRef.current) {
                ringtoneRef.current.stop();
            }
            ringtoneRef.current = createRingtone();
        };

        playRingtone(); // Play immediately
        ringtoneIntervalRef.current = setInterval(playRingtone, 2000);

        // Auto-reject call after 30 seconds
        timeoutRef.current = setTimeout(() => {
            handleReject('Call timed out');
        }, 30000);

        return () => {
            cleanupRingtone();
        };
    }, [socket]);

    const cleanupRingtone = () => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
        if (ringtoneRef.current) {
            ringtoneRef.current.stop();
            ringtoneRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handleAccept = () => {
        if (!socket) {
            toast.error('No connection to server');
            return;
        }

        cleanupRingtone();
        onAccept(call);
    };

    const handleReject = (reason = 'Call rejected') => {
        if (!socket) {
            toast.error('No connection to server');
            return;
        }

        cleanupRingtone();
        onReject(call, reason);
    };

    if (!call) return null;

    return (
        <div className="incoming-call-modal">
            <div className="call-content">
                <div className="call-header">
                    <h2>Incoming Investigation Call</h2>
                    <div className="call-info">
                        <p className="investigator-name">{call.investigatorName}</p>
                        <p className="claim-number">{call.claimNumber}</p>
                    </div>
                </div>
                <div className="call-actions">
                    <button 
                        className="accept-btn" 
                        onClick={handleAccept}
                        disabled={!socket}
                    >
                        <FaPhone />
                        Accept
                    </button>
                    <button 
                        className="reject-btn" 
                        onClick={() => handleReject()}
                        disabled={!socket}
                    >
                        <FaPhoneSlash />
                        Reject
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;
