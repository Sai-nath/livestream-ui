import React, { useEffect, useRef, useState } from 'react';
import { FaCamera, FaCameraRetro, FaDesktop, FaPhoneSlash, FaImage } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './VideoCall.css';

const VideoCall = ({ 
    role, // 'investigator' or 'supervisor'
    callId,
    socket,
    onEndCall 
}) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isBackCamera, setIsBackCamera] = useState(role === 'investigator');
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [screenshots, setScreenshots] = useState([]);
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);

    // WebRTC configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    useEffect(() => {
        if (!socket) {
            toast.error('No connection to server');
            return;
        }

        const init = async () => {
            try {
                console.log('Initializing video call:', { role, callId });
                await initializeCall();
                setupSocketListeners();
            } catch (error) {
                console.error('Error initializing video call:', error);
                toast.error('Failed to initialize video call');
                onEndCall();
            }
        };

        init();

        return () => {
            cleanupCall();
        };
    }, [socket, callId]);

    const setupMediaStream = async () => {
        try {
            console.log('Setting up media stream, isBackCamera:', isBackCamera);
            const constraints = {
                video: {
                    facingMode: isBackCamera ? 'environment' : 'user'
                },
                audio: true
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Got media stream:', stream.getTracks().map(t => t.kind));
            setLocalStream(stream);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Add tracks to peer connection if it exists
            if (peerConnectionRef.current && stream) {
                stream.getTracks().forEach(track => {
                    console.log('Adding track to peer connection:', track.kind);
                    peerConnectionRef.current.addTrack(track, stream);
                });
            }

            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            toast.error('Failed to access camera and microphone');
            throw error;
        }
    };

    const initializeCall = async () => {
        try {
            console.log('Creating peer connection');
            // Create RTCPeerConnection
            peerConnectionRef.current = new RTCPeerConnection(configuration);
            
            // Setup media stream
            const stream = await setupMediaStream();
            setLocalStream(stream);

            // Handle incoming tracks
            peerConnectionRef.current.ontrack = (event) => {
                console.log('Received remote track:', event.track.kind);
                setRemoteStream(event.streams[0]);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Handle ICE candidates
            peerConnectionRef.current.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate');
                    socket.emit('ice_candidate', {
                        callId,
                        candidate: event.candidate
                    });
                }
            };

            peerConnectionRef.current.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState);
            };

            setIsCameraReady(true);

            // Create and send offer if investigator
            if (role === 'investigator') {
                console.log('Creating offer as investigator');
                const offer = await peerConnectionRef.current.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                });
                await peerConnectionRef.current.setLocalDescription(offer);
                socket.emit('video_offer', { callId, offer });
            }
        } catch (error) {
            console.error('Error initializing call:', error);
            toast.error('Failed to initialize video call');
            throw error;
        }
    };

    const setupSocketListeners = () => {
        console.log('Setting up socket listeners');
        
        socket.on('video_offer', async ({ offer }) => {
            try {
                console.log('Received video offer');
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                socket.emit('video_answer', { callId, answer });
            } catch (error) {
                console.error('Error handling video offer:', error);
                toast.error('Failed to process video offer');
            }
        });

        socket.on('video_answer', async ({ answer }) => {
            try {
                console.log('Received video answer');
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                console.error('Error handling video answer:', error);
                toast.error('Failed to process video answer');
            }
        });

        socket.on('ice_candidate', async ({ candidate }) => {
            try {
                console.log('Received ICE candidate');
                if (peerConnectionRef.current.remoteDescription) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });

        socket.on('call_ended', () => {
            console.log('Call ended by peer');
            cleanupCall();
            onEndCall();
        });
    };

    const toggleCamera = async () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        setIsBackCamera(!isBackCamera);
        await setupMediaStream();
    };

    const takeScreenshot = () => {
        const canvas = document.createElement('canvas');
        const video = remoteVideoRef.current;
        
        if (video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            const screenshot = {
                id: Date.now(),
                url: canvas.toDataURL('image/jpeg'),
                timestamp: new Date().toISOString()
            };
            
            setScreenshots(prev => [...prev, screenshot]);
            toast.success('Screenshot captured');

            // Save screenshot to server
            socket.emit('save_screenshot', {
                callId,
                screenshot: screenshot.url,
                timestamp: screenshot.timestamp
            });
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
                .find(s => s.track.kind === 'video');
                
            await sender.replaceTrack(videoTrack);
            setIsScreenSharing(true);

            videoTrack.onended = () => {
                stopScreenSharing();
            };
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
                .find(s => s.track.kind === 'video');
                
            await sender.replaceTrack(videoTrack);
            setIsScreenSharing(false);
        } catch (error) {
            console.error('Error stopping screen share:', error);
        }
    };

    const endCall = () => {
        socket.emit('end_call', { callId });
        cleanupCall();
        onEndCall();
    };

    const cleanupCall = () => {
        console.log('Cleaning up call');
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        setLocalStream(null);
        setRemoteStream(null);
        setIsCameraReady(false);

        // Remove socket listeners
        if (socket) {
            socket.off('video_offer');
            socket.off('video_answer');
            socket.off('ice_candidate');
            socket.off('call_ended');
        }
    };

    return (
        <div className="video-call-container">
            <div className="video-grid">
                <div className="video-wrapper remote">
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="remote-video"
                    />
                    <div className="video-label">
                        {role === 'supervisor' ? 'Investigator' : 'Supervisor'}
                    </div>
                </div>
                <div className="video-wrapper local">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="local-video"
                    />
                    <div className="video-label">You</div>
                </div>
            </div>

            <div className="controls">
                {role === 'investigator' && (
                    <button 
                        className="control-btn"
                        onClick={toggleCamera}
                        title={isBackCamera ? 'Switch to front camera' : 'Switch to back camera'}
                    >
                        {isBackCamera ? <FaCamera /> : <FaCameraRetro />}
                    </button>
                )}
                
                <button 
                    className="control-btn"
                    onClick={shareScreen}
                    disabled={isScreenSharing}
                    title="Share screen"
                >
                    <FaDesktop />
                </button>
                
                {role === 'supervisor' && (
                    <button 
                        className="control-btn"
                        onClick={takeScreenshot}
                        title="Take screenshot"
                    >
                        <FaImage />
                    </button>
                )}
                
                <button 
                    className="control-btn end-call"
                    onClick={endCall}
                    title="End call"
                >
                    <FaPhoneSlash />
                </button>
            </div>

            {screenshots.length > 0 && role === 'supervisor' && (
                <div className="screenshots">
                    <h3>Screenshots</h3>
                    <div className="screenshot-grid">
                        {screenshots.map(screenshot => (
                            <div key={screenshot.id} className="screenshot">
                                <img src={screenshot.url} alt={`Screenshot ${screenshot.timestamp}`} />
                                <span className="timestamp">
                                    {new Date(screenshot.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoCall;
