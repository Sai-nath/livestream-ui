import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { FaCamera, FaCameraRetro, FaPhoneSlash, FaImage, FaComment, 
         FaMicrophone, FaMicrophoneSlash, FaLightbulb, FaVideo, FaVideoSlash } from 'react-icons/fa';
import { TiMessages } from 'react-icons/ti';
import { uploadScreenshot, startRecording } from '../../utils/azureStorageUtils';
import './VideoCall.css';

const VideoCall = ({ socket, role, callId, onEndCall, claimNumber }) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isBackCamera, setIsBackCamera] = useState(role === 'investigator');
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [isChatMinimized, setIsChatMinimized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [hasMediaPermissions, setHasMediaPermissions] = useState(false);
    const [isCallInitialized, setIsCallInitialized] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [selectedScreenshot, setSelectedScreenshot] = useState(null);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingUrl, setRecordingUrl] = useState(null);
    const [uploadStatus, setUploadStatus] = useState({ uploading: false, progress: 0 });

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const recordingStateRef = useRef(null);

    // WebRTC configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    };

    // Get geolocation if investigator and share it periodically
    useEffect(() => {
        if (role === 'investigator' && navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    setCurrentLocation(locationData);
                    
                    // Share location with supervisor every 10 seconds
                    if (socket && isCallInitialized) {
                        socket.emit('location_update', { 
                            callId, 
                            location: locationData,
                            timestamp: new Date().toISOString()
                        });
                    }
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    toast.warning('Unable to access location. Some features may be limited.');
                },
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 27000 }
            );
            
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, [role, socket, isCallInitialized]);

    const initializeCall = async (isRefresh = false) => {
        try {
            console.log('Initializing call...');
            
            // Create new peer connection
            peerConnectionRef.current = new RTCPeerConnection(configuration);
            
            // Set up media stream first
            const stream = await setupMediaStream();
            
            if (!stream) {
                throw new Error('Failed to get media stream');
            }

            // Add tracks to peer connection
            stream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, stream);
            });

            // Set up event handlers
            setupPeerConnectionHandlers();

            if (isRefresh) {
                socket.emit('rejoin_call', { callId, role, claimNumber });
            } else {
                socket.emit('join_call', { callId, role, claimNumber });
            }

            setIsCallInitialized(true);
            
            return true;
        } catch (error) {
            console.error('Error initializing call:', error);
            peerConnectionRef.current = null;
            throw error;
        }
    };

    const setupMediaStream = async () => {
        try {
            console.log('Setting up media stream, camera:', isBackCamera ? 'back' : 'front');
            
            const constraints = {
                video: {
                    facingMode: isBackCamera ? 'environment' : 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Got media stream:', stream.getTracks().map(t => t.kind));

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            setLocalStream(stream);
            mediaStreamRef.current = stream;
            setIsCameraReady(true);
            setHasMediaPermissions(true);

            return stream;
        } catch (error) {
            console.error('Error setting up media stream:', error);
            setHasMediaPermissions(false);
            toast.error('Failed to access camera/microphone. Please check permissions.');
            throw error;
        }
    };

    const setupPeerConnectionHandlers = () => {
        if (!peerConnectionRef.current) return;

        peerConnectionRef.current.ontrack = (event) => {
            console.log('Received remote track');
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setRemoteStream(event.streams[0]);
            }
        };

        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', { callId, candidate: event.candidate });
            }
        };

        peerConnectionRef.current.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnectionRef.current.connectionState);
            handleConnectionStateChange();
        };
    };

    // Initial call setup effect
    useEffect(() => {
        if (!socket) {
            toast.error('No connection to server');
            return;
        }

        const startCall = async () => {
            try {
                await initializeCall();
                console.log('Call initialized successfully');
            } catch (error) {
                console.error('Failed to start call:', error);
                toast.error('Failed to start call. Please try again.');
                onEndCall();
            }
        };

        startCall();

        // Cleanup function
        return () => {
            console.log('Cleaning up call...');
            cleanupCall();
        };
    }, [socket, callId]);

    const cleanupCall = () => {
        console.log('Running cleanup...');
        
        // Stop recording if active
        if (isRecording && recordingStateRef.current) {
            recordingStateRef.current.stopRecording().catch(err => 
                console.error('Error stopping recording during cleanup:', err)
            );
        }
        
        // Stop all tracks in local stream
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
            setLocalStream(null);
        }

        // Stop all tracks in remote stream
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => {
                track.stop();
            });
            setRemoteStream(null);
        }

        // Clear video elements
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }

        // Close and cleanup peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.onicecandidate = null;
            peerConnectionRef.current.onconnectionstatechange = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Reset state
        setIsCameraReady(false);
        setIsCallInitialized(false);
        setHasMediaPermissions(false);
        setIsRecording(false);
        mediaStreamRef.current = null;
        recordingStateRef.current = null;

        // Clear session storage
        sessionStorage.removeItem('callState');
    };

    const handleEndCall = () => {
        // Stop recording if active
        if (isRecording) {
            stopRecording().catch(err => 
                console.error('Error stopping recording before ending call:', err)
            );
        }
        
        socket.emit('end_call', { callId });
        cleanupCall();
        onEndCall();
    };

    // Handle incoming socket events
    useEffect(() => {
        if (!socket) return;

        const handleUserDisconnected = ({ userId }) => {
            console.log('User disconnected:', userId);
            toast.warning('Participant disconnected. They may rejoin shortly.');
        };

        const handleCallEnded = () => {
            console.log('Call ended by peer');
            cleanupCall();
            onEndCall();
        };

        const handleParticipantRejoined = ({ role: rejoiningRole }) => {
            console.log('Participant rejoined:', rejoiningRole);
            toast.info(`${rejoiningRole} has rejoined the call`);
        };
        
        const handleRecordingStatus = ({ isRecording: remoteRecording, startedBy, stoppedBy }) => {
            if (remoteRecording) {
                toast.info(`Recording started by ${startedBy}`);
                if (!isRecording) {
                    setIsRecording(true);
                }
            } else {
                toast.info(`Recording stopped by ${stoppedBy}`);
                if (isRecording && !recordingStateRef.current) {
                    setIsRecording(false);
                }
            }
        };

        socket.on('user_disconnected', handleUserDisconnected);
        socket.on('call_ended', handleCallEnded);
        socket.on('participant_rejoined', handleParticipantRejoined);
        socket.on('recording_status', handleRecordingStatus);

        // Cleanup socket listeners
        return () => {
            socket.off('user_disconnected', handleUserDisconnected);
            socket.off('call_ended', handleCallEnded);
            socket.off('participant_rejoined', handleParticipantRejoined);
            socket.off('recording_status', handleRecordingStatus);
        };
    }, [socket, isRecording]);

    // Handle WebRTC reconnection
    useEffect(() => {
        let reconnectTimeout;

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && !peerConnectionRef.current) {
                console.log('Page became visible, checking connection...');
                try {
                    await initializeCall(true);
                } catch (error) {
                    console.error('Failed to reconnect on visibility change:', error);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, []);

    const toggleTorch = async () => {
        try {
            if (mediaStreamRef.current) {
                const track = mediaStreamRef.current.getVideoTracks()[0];
                if (track.getCapabilities().torch) {
                    await track.applyConstraints({
                        advanced: [{ torch: !isTorchOn }]
                    });
                    setIsTorchOn(!isTorchOn);
                } else {
                    toast.warning('Torch not available on this device');
                }
            }
        } catch (error) {
            console.error('Error toggling torch:', error);
            toast.error('Failed to toggle torch');
        }
    };

    const toggleMute = () => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = isMuted;
            });
            setIsMuted(!isMuted);
            socket.emit('participant_muted', { callId, isMuted: !isMuted });
        }
    };

    // Fixed camera toggle function to properly handle track replacement
    const toggleCamera = async () => {
        try {
            if (!peerConnectionRef.current) {
                console.error('No peer connection available');
                return;
            }

            const newIsBackCamera = !isBackCamera;
            console.log('Switching to camera:', newIsBackCamera ? 'back' : 'front');

            // Stop old tracks first
            if (localStream) {
                localStream.getVideoTracks().forEach(track => track.stop());
            }

            // Get new stream with switched camera
            const videoConstraints = {
                facingMode: newIsBackCamera ? 'environment' : 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            };

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: false // We'll handle audio separately
            });

            // Get a new audio track
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) {
                newStream.addTrack(audioTrack);
            }

            // Update local video
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = newStream;
            }

            // Update state
            setLocalStream(newStream);
            mediaStreamRef.current = newStream;
            setIsBackCamera(newIsBackCamera);
            localStorage.setItem('preferredCamera', newIsBackCamera ? 'back' : 'front');

            // Remove all existing senders
            const senders = peerConnectionRef.current.getSenders();
            senders.forEach(sender => {
                if (sender.track) {
                    peerConnectionRef.current.removeTrack(sender);
                }
            });

            // Add new tracks to peer connection
            newStream.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, newStream);
            });

            // Create and send a new offer to renegotiate the connection
            const offer = await peerConnectionRef.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnectionRef.current.setLocalDescription(offer);
            socket.emit('video_offer', { callId, offer });

            console.log('Camera switch completed successfully');
        } catch (error) {
            console.error('Error switching camera:', error);
            toast.error('Failed to switch camera. Please try again.');
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;

        const messageData = {
            callId,
            role,
            message: newMessage.trim(),
            timestamp: new Date().toISOString(),
            type: 'chat' // Add type to distinguish from screenshots
        };

        // Emit message to server
        socket.emit('chat_message', messageData);
        
        // Add message to local state
        setMessages(prev => [...prev, { ...messageData, isLocal: true }]);
        setNewMessage('');
    };

    const handleConnectionStateChange = () => {
        if (peerConnectionRef.current) {
            const state = peerConnectionRef.current.connectionState;
            console.log('Connection state changed:', state);

            switch (state) {
                case 'disconnected':
                    // Try to reconnect if disconnected
                    console.log('Attempting reconnection');
                    initializeCall(true).catch(error => {
                        console.error('Reconnection attempt failed:', error);
                        toast.error('Connection lost. Please rejoin.');
                        cleanupCall();
                    });
                    break;
                case 'failed':
                    toast.error('Connection failed. Please check your internet connection.');
                    break;
                case 'connected':
                    console.log('Connected to peer');
                    break;
            }
        }
    };

    // Fixed to properly handle screenshots for both roles with investigator location and Azure storage
    const takeScreenshot = async () => {
        try {
            let videoToCapture;
            let locationInfo = null;
            
            if (role === 'investigator') {
                // Investigator captures their own video
                videoToCapture = localVideoRef.current;
                if (currentLocation) {
                    locationInfo = {
                        latitude: currentLocation.latitude,
                        longitude: currentLocation.longitude,
                        accuracy: currentLocation.accuracy
                    };
                }
            } else {
                // Supervisor captures the investigator's video stream
                videoToCapture = remoteVideoRef.current;
                
                // Use the most recent location data from investigator
                if (messages.some(m => m.type === 'location_update')) {
                    const lastLocationMsg = [...messages]
                        .filter(m => m.type === 'location_update')
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                    
                    if (lastLocationMsg && lastLocationMsg.location) {
                        locationInfo = lastLocationMsg.location;
                    } else {
                        // Request updated location if none found
                        socket.emit('request_location', { callId });
                    }
                } else {
                    // Request location if none available
                    socket.emit('request_location', { callId });
                }
            }

            if (!videoToCapture || !videoToCapture.srcObject) {
                toast.error("No video stream available to capture");
                return;
            }

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = videoToCapture.videoWidth;
            canvas.height = videoToCapture.videoHeight;
            
            // Draw the video frame (handle mirroring for front camera)
            if (role === 'investigator' && !isBackCamera) {
                // Front camera needs to be un-mirrored for screenshot
                context.translate(canvas.width, 0);
                context.scale(-1, 1);
                context.drawImage(videoToCapture, 0, 0, -canvas.width, canvas.height);
            } else {
                context.drawImage(videoToCapture, 0, 0, canvas.width, canvas.height);
            }
            
            // Add location information if available (for both roles)
            if (locationInfo) {
                // Format the location text
                const locationText = `Lat: ${locationInfo.latitude.toFixed(6)}, Long: ${locationInfo.longitude.toFixed(6)}`;
                
                // Add semi-transparent background for text
                context.fillStyle = 'rgba(0, 0, 0, 0.5)';
                context.fillRect(10, canvas.height - 70, canvas.width - 20, 60);
                
                // Add location text
                context.fillStyle = 'white';
                context.font = '16px Arial';
                context.fillText(locationText, 20, canvas.height - 45);
                context.fillText(`Accuracy: ${locationInfo.accuracy.toFixed(1)}m`, 20, canvas.height - 20);
                
                // Add timestamp
                const timestamp = new Date().toLocaleString();
                context.fillText(timestamp, 20, canvas.height - 70);
            } else {
                // Always add timestamp even if no location
                const timestamp = new Date().toLocaleString();
                context.fillStyle = 'rgba(0, 0, 0, 0.5)';
                context.fillRect(10, canvas.height - 30, canvas.width - 20, 30);
                context.fillStyle = 'white';
                context.font = '16px Arial';
                context.fillText(timestamp, 20, canvas.height - 10);
            }
            
            const timestamp = new Date().toISOString();
            const screenshotDataUrl = canvas.toDataURL('image/jpeg');
            
            // Create screenshot metadata
            const screenshot = {
                id: Date.now(),
                url: screenshotDataUrl,
                timestamp: timestamp,
                location: locationInfo,
                type: 'screenshot',
                locationText: locationInfo ? `${locationInfo.latitude.toFixed(6)}, ${locationInfo.longitude.toFixed(6)}` : null,
                timestampText: new Date(timestamp).toLocaleString(),
                capturedBy: role
            };
            
            // Add screenshot to messages
            setMessages(prev => [...prev, { ...screenshot, isLocal: true }]);
            toast.success('Screenshot captured');

            // Save to Azure Storage
            if (claimNumber) {
                setUploadStatus({ uploading: true, progress: 10 });
                
                try {
                    const blobUrl = await uploadScreenshot(
                        claimNumber,
                        callId,
                        screenshotDataUrl,
                        {
                            timestamp: timestamp,
                            capturedBy: role,
                            location: locationInfo
                        }
                    );
                    
                    // Update the screenshot with the Azure URL
                    setMessages(prev => prev.map(msg => 
                        msg.id === screenshot.id 
                            ? { ...msg, azureUrl: blobUrl }
                            : msg
                    ));
                    
                    toast.success('Screenshot saved to cloud storage');
                    setUploadStatus({ uploading: false, progress: 100 });
                } catch (error) {
                    console.error('Failed to upload screenshot to Azure:', error);
                    toast.error('Failed to save screenshot to cloud storage');
                    setUploadStatus({ uploading: false, progress: 0 });
                }
            }

            // Save screenshot to server and notify other participants
            socket.emit('save_screenshot', {
                callId,
                screenshot: screenshotDataUrl,
                timestamp: timestamp,
                location: locationInfo,
                capturedBy: role,
                claimNumber: claimNumber || null
            });
        } catch (error) {
            console.error('Error taking screenshot:', error);
            toast.error('Failed to capture screenshot');
            setUploadStatus({ uploading: false, progress: 0 });
        }
    };
    
    // Toggle recording function
    const toggleRecording = async () => {
        if (isRecording) {
            await stopRecording();
        } else {
            await startCallRecording();
        }
    };
    
    // Start recording function
    const startCallRecording = async () => {
        if (!claimNumber) {
            toast.error('Cannot start recording: No claim number provided');
            return;
        }
        
        try {
            // For supervisor, record the investigator's stream
            // For investigator, record their own stream
            const streamToRecord = role === 'supervisor' 
                ? remoteVideoRef.current.srcObject 
                : localVideoRef.current.srcObject;
                
            if (!streamToRecord) {
                toast.error('No video stream available to record');
                return;
            }
            
            toast.info('Starting recording...');
            setUploadStatus({ uploading: true, progress: 0 });
            
            // Start recording
            recordingStateRef.current = await startRecording(
                claimNumber,
                callId,
                streamToRecord
            );
            
            setIsRecording(true);
            toast.success('Recording started');
            
            // Notify other participants
            socket.emit('recording_status', { 
                callId, 
                isRecording: true,
                startedBy: role,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to start recording:', error);
            toast.error('Failed to start recording');
            setIsRecording(false);
            setUploadStatus({ uploading: false, progress: 0 });
        }
    };
    
    // Stop recording function
    const stopRecording = async () => {
        if (!recordingStateRef.current) {
            setIsRecording(false);
            return;
        }
        
        try {
            toast.info('Stopping recording...');
            setUploadStatus({ uploading: true, progress: 50 });
            
            // Stop recording and upload
            const blobUrl = await recordingStateRef.current.stopRecording();
            
            if (blobUrl) {
                setRecordingUrl(blobUrl);
                toast.success('Recording saved to cloud storage');
            }
            
            // Reset recording state
            recordingStateRef.current = null;
            setIsRecording(false);
            setUploadStatus({ uploading: false, progress: 100 });
            
            // Notify other participants
            socket.emit('recording_status', { 
                callId, 
                isRecording: false,
                stoppedBy: role,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error stopping recording:', error);
            toast.error('Failed to save recording');
            setIsRecording(false);
            setUploadStatus({ uploading: false, progress: 0 });
        }
    };

    const shareScreen = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            
            // Replace video track
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = peerConnectionRef.current
                .getSenders()
                .find(s => s.track && s.track.kind === 'video');
                
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
        } catch (error) {
            console.error('Error sharing screen:', error);
            toast.error('Failed to share screen');
        }
    };

    const stopScreenSharing = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: isBackCamera ? 'environment' : 'user' }
            });
            
            const videoTrack = stream.getVideoTracks()[0];
            const sender = peerConnectionRef.current
                .getSenders()
                .find(s => s.track && s.track.kind === 'video');
                
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
        } catch (error) {
            console.error('Error stopping screen share:', error);
        }
    };

    // WebRTC handler 
    useEffect(() => {
        if (!socket || !isCallInitialized) return;

        const handleVideoOffer = async ({ offer }) => {
            try {
                console.log('Received video offer');
                if (!peerConnectionRef.current) {
                    console.log('Creating new peer connection for offer');
                    peerConnectionRef.current = new RTCPeerConnection(configuration);
                    setupPeerConnectionHandlers();
                }

                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
                
                // Set up local stream if not already done
                if (!localStream) {
                    const stream = await setupMediaStream();
                    stream.getTracks().forEach(track => {
                        peerConnectionRef.current.addTrack(track, stream);
                    });
                }

                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                socket.emit('video_answer', { callId, answer });
            } catch (error) {
                console.error('Error handling video offer:', error);
                toast.error('Failed to process incoming video');
            }
        };

        const handleVideoAnswer = async ({ answer }) => {
            try {
                console.log('Received video answer');
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                    console.log('Remote description set successfully');
                }
            } catch (error) {
                console.error('Error handling video answer:', error);
                toast.error('Failed to establish video connection');
            }
        };

        const handleIceCandidate = async ({ candidate }) => {
            try {
                console.log('Received ICE candidate');
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (error) {
                console.error('Error handling ICE candidate:', error);
            }
        };

        // Set up signaling handlers
        socket.on('video_offer', handleVideoOffer);
        socket.on('video_answer', handleVideoAnswer);
        socket.on('ice_candidate', handleIceCandidate);

        // Create and send offer if investigator
        const createOffer = async () => {
            if (role === 'investigator' && peerConnectionRef.current) {
                try {
                    console.log('Creating offer as investigator');
                    const offer = await peerConnectionRef.current.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: true
                    });
                    await peerConnectionRef.current.setLocalDescription(offer);
                    socket.emit('video_offer', { callId, offer });
                } catch (error) {
                    console.error('Error creating offer:', error);
                    toast.error('Failed to start video call');
                }
            }
        };

        createOffer();

        return () => {
            socket.off('video_offer', handleVideoOffer);
            socket.off('video_answer', handleVideoAnswer);
            socket.off('ice_candidate', handleIceCandidate);
        };
    }, [socket, isCallInitialized, role, localStream]);

    // Chat and location socket handlers
    useEffect(() => {
        if (!socket) return;

        const handleChatMessage = (data) => {
            console.log('Received chat message:', data);
            // Add type if it doesn't exist
            const messageWithType = {
                ...data, 
                type: data.type || 'chat',
                isLocal: false
            };
            setMessages(prev => [...prev, messageWithType]);
            
            // Increment unread count if chat is not visible
            if (!showChat || isChatMinimized) {
                setUnreadMessages(prev => prev + 1);
                // Play notification sound if available
                const notificationSound = document.getElementById('notification-sound');
                if (notificationSound) {
                    notificationSound.play().catch(err => console.error('Failed to play notification sound:', err));
                }
            }
        };
        
        const handleLocationUpdate = (data) => {
            console.log('Received location update:', data);
            if (role === 'supervisor') {
                // Store location updates in messages for supervisor
                setMessages(prev => [
                    ...prev, 
                    {
                        type: 'location_update',
                        timestamp: data.timestamp,
                        location: data.location,
                        isLocal: false
                    }
                ]);
            }
        };
        
        const handleLocationRequest = () => {
            // Investigator responds to location requests
            if (role === 'investigator' && currentLocation) {
                socket.emit('location_update', {
                    callId,
                    location: currentLocation,
                    timestamp: new Date().toISOString()
                });
            }
        };
        
        const handleScreenshotReceived = (data) => {
            // Handle receiving screenshot from other participant
            if (data.capturedBy !== role) {
                const screenshot = {
                    id: Date.now(),
                    url: data.screenshot,
                    timestamp: data.timestamp,
                    location: data.location,
                    type: 'screenshot',
                    locationText: data.location ? 
                        `${data.location.latitude.toFixed(6)}, ${data.location.longitude.toFixed(6)}` : null,
                    timestampText: new Date(data.timestamp).toLocaleString(),
                    capturedBy: data.capturedBy,
                    isLocal: false,
                    azureUrl: data.azureUrl || null
                };
                
                setMessages(prev => [...prev, screenshot]);
                toast.info(`${data.capturedBy} captured a screenshot`);
            }
        };

        socket.on('chat_message', handleChatMessage);
        socket.on('location_update', handleLocationUpdate);
        socket.on('request_location', handleLocationRequest);
        socket.on('screenshot_received', handleScreenshotReceived);

        return () => {
            socket.off('chat_message', handleChatMessage);
            socket.off('location_update', handleLocationUpdate);
            socket.off('request_location', handleLocationRequest);
            socket.off('screenshot_received', handleScreenshotReceived);
        };
    }, [socket, role, currentLocation, showChat, isChatMinimized]);

    // Initialize with back camera for investigator on mobile
    useEffect(() => {
        if (role === 'investigator' && /Mobi|Android/i.test(navigator.userAgent)) {
            const preferredCamera = localStorage.getItem('preferredCamera');
            const shouldUseBackCamera = preferredCamera ? preferredCamera === 'back' : true;
            setIsBackCamera(shouldUseBackCamera);
        }
    }, [role]);

    const toggleChat = () => {
        if (showChat && !isChatMinimized) {
            setIsChatMinimized(true);
        } else {
            setShowChat(!showChat);
            setIsChatMinimized(false);
            // Clear unread message count when opening chat
            setUnreadMessages(0);
        }
    };

    // Auto-scroll chat when new messages arrive
    useEffect(() => {
        if (chatMessagesRef.current && !isChatMinimized) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages, isChatMinimized]);
    
    // Function to handle screenshot click - show in modal instead of new tab
    const handleScreenshotClick = (screenshot) => {
        setSelectedScreenshot(screenshot);
    };
    
    // Function to close screenshot modal
    const closeScreenshotModal = () => {
        setSelectedScreenshot(null);
    };

    return (
        <div className={`video-call-container ${role}`}>
            {/* Notification sound (hidden) */}
            <audio id="notification-sound" preload="auto" src="/assets/sounds/notification.mp3" />
            
            {role === 'investigator' ? (
                <div className="video-layout-investigator">
                    <div className="video-fullscreen">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`video-fullscreen-stream ${!isBackCamera ? 'mirror-video' : ''}`}
                        />
                    </div>

                    <div className="pip-container">
                        <div className="pip-video">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="pip-stream"
                            />
                            <div className="pip-label">Supervisor</div>
                        </div>
                    </div>

                    {uploadStatus.uploading && (
                        <div className="upload-progress">
                            <div 
                                className="progress-bar" 
                                style={{width: `${uploadStatus.progress}%`}}
                            ></div>
                        </div>
                    )}

                    <div className="video-controls-mobile">
                        <button onClick={toggleCamera} disabled={!isCameraReady}>
                            {isBackCamera ? <FaCameraRetro /> : <FaCamera />}
                        </button>
                        {role === 'investigator' && (
                            <button onClick={toggleTorch} disabled={!isCameraReady}>
                                <FaLightbulb className={isTorchOn ? 'torch-on' : ''} />
                            </button>
                        )}
                        <button onClick={toggleMute}>
                            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                        </button>
                        <button onClick={toggleChat} className={unreadMessages > 0 ? 'has-notification' : ''}>
                            {unreadMessages > 0 ? (
                                <>
                                    <TiMessages />
                                    <span className="notification-badge">{unreadMessages}</span>
                                </>
                            ) : (
                                <FaComment />
                            )}
                        </button>
                        <button onClick={toggleRecording} className={isRecording ? "recording" : ""}>
                            {isRecording ? <FaVideoSlash /> : <FaVideo />}
                        </button>
                        <button onClick={handleEndCall} className="end-call">
                            <FaPhoneSlash />
                        </button>
                        <button onClick={takeScreenshot} disabled={!isCameraReady}>
                            <FaImage />
                        </button>
                    </div>
                </div>
            ) : (
                // Supervisor layout remains mostly the same, just add chat and mute
                <div className="video-layout-supervisor">
                    {/* Large investigator stream */}
                    <div className="video-main-feed">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="video-large-stream"
                        />
                        <div className="stream-label">Investigator Camera</div>
                    </div>

                    {uploadStatus.uploading && (
                        <div className="upload-progress">
                            <div 
                                className="progress-bar" 
                                style={{width: `${uploadStatus.progress}%`}}
                            ></div>
                        </div>
                    )}

                    {/* Side panel for participants */}
                    <div className="side-panel">
                        {/* Supervisor's preview */}
                        <div className="participant-video">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="video-small"
                            />
                            <div className="participant-label">You</div>
                        </div>

                        {/* Placeholder for future participants */}
                        <div className="participant-video placeholder">
                            <div className="participant-label">Waiting for participant...</div>
                        </div>

                        {/* Web controls */}
                        <div className="video-controls-web">
                            <button onClick={toggleMute}>
                                {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
                            </button>
                            <button onClick={toggleChat} className={unreadMessages > 0 ? 'has-notification' : ''}>
                                {unreadMessages > 0 ? (
                                    <>
                                        <TiMessages />
                                        <span className="notification-badge">{unreadMessages}</span>
                                    </>
                                ) : (
                                    <FaComment />
                                )}
                            </button>
                            <button onClick={toggleRecording} className={isRecording ? "recording" : ""}>
                                {isRecording ? <FaVideoSlash /> : <FaVideo />}
                            </button>
                            <button onClick={handleEndCall} className="end-call">
                                <FaPhoneSlash />
                            </button>
                            <button onClick={takeScreenshot} disabled={!remoteStream}>
                                <FaImage />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Window */}
            {showChat && (
                <div className={`chat-window ${role} ${isChatMinimized ? 'minimized' : ''}`}>
                    <div className="chat-header">
                        <span>Chat</span>
                        <div className="chat-controls">
                            <button 
                                className="minimize-button"
                                onClick={() => setIsChatMinimized(!isChatMinimized)}
                            >
                                {isChatMinimized ? '□' : '−'}
                            </button>
                            <button 
                                className="close-button"
                                onClick={() => {
                                    setShowChat(false);
                                    setIsChatMinimized(false);
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    {!isChatMinimized && (
                        <>
                            <div className="chat-messages" ref={chatMessagesRef}>
                                {messages
                                    .filter(msg => msg.type === 'chat' || msg.message) // Only show chat messages
                                    .map((msg, index) => (
                                        <div key={index} className={`message ${msg.isLocal ? 'local' : 'remote'}`}>
                                            <div className="message-role">{msg.role}</div>
                                            <div className="message-content">{msg.message}</div>
                                            <div className="message-time">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            <form onSubmit={sendMessage} className="chat-input">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."/>
                                <button type="submit">Send</button>
                            </form>
                        </>
                    )}
                </div>
            )}
            
            {/* Screenshots panel - now only shows actual screenshots */}
            {messages.some(item => item.type === 'screenshot' || item.url) && (
                <div className={`screenshots ${role}`}>
                    {messages
                        .filter(item => item.type === 'screenshot' || item.url) // Only show screenshots
                        .map((screenshot, index) => (
                            <img 
                                key={index} 
                                src={screenshot.url} 
                                alt={`Screenshot ${index + 1}`}
                                onClick={() => handleScreenshotClick(screenshot)}
                            />
                        ))}
                </div>
            )}
            
            {/* Screenshot Modal - Shows when a screenshot is clicked */}
            {selectedScreenshot && (
                <div className="screenshot-modal" onClick={closeScreenshotModal}>
                    <div className="screenshot-modal-content" onClick={e => e.stopPropagation()}>
                        <span className="close-modal" onClick={closeScreenshotModal}>&times;</span>
                        <img src={selectedScreenshot.url} alt="Full-size screenshot" />
                        <div className="screenshot-info">
                            <p className="screenshot-timestamp">Taken: {selectedScreenshot.timestampText}</p>
                            {selectedScreenshot.locationText && (
                                <p className="screenshot-location">Location: {selectedScreenshot.locationText}</p>
                            )}
                            {selectedScreenshot.capturedBy && (
                                <p className="screenshot-author">Captured by: {selectedScreenshot.capturedBy}</p>
                            )}
                            {selectedScreenshot.azureUrl && (
                                <p className="screenshot-storage">
                                    <a href={selectedScreenshot.azureUrl} target="_blank" rel="noopener noreferrer">
                                        View in cloud storage
                                    </a>
                                </p>
                            )}
                            {claimNumber && (
                                <p className="screenshot-claim">Claim: {claimNumber}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
                <div className="recording-indicator">
                    <div className="recording-dot"></div>
                    <span>Recording</span>
                </div>
            )}
        </div>
    );
};

export default VideoCall;