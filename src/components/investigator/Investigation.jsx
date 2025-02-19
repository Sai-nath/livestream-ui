import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const Investigation = () => {
    const { investigationId } = useParams();
    const [investigation, setInvestigation] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isFrontCamera, setIsFrontCamera] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [streamQuality, setStreamQuality] = useState('good');
    
    const videoRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const socket = useSocket();
    const { user } = useAuth();

    useEffect(() => {
        fetchInvestigationDetails();
        initializeGeolocation();
        
        // Socket event listeners
        socket.on('message', handleNewMessage);
        socket.on('requestFrontCamera', handleFrontCameraRequest);
        socket.on('streamQualityUpdate', handleStreamQualityUpdate);
        
        return () => {
            stopStream();
            socket.off('message', handleNewMessage);
            socket.off('requestFrontCamera', handleFrontCameraRequest);
            socket.off('streamQualityUpdate', handleStreamQualityUpdate);
        };
    }, [investigationId]);

    const fetchInvestigationDetails = async () => {
        try {
            const response = await fetch(`/api/investigations/${investigationId}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            const data = await response.json();
            setInvestigation(data);
        } catch (error) {
            toast.error('Error fetching investigation details');
        }
    };

    const initializeGeolocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (position) => {
                    socket.emit('updateLocation', {
                        investigationId,
                        location: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        }
                    });
                },
                (error) => {
                    toast.error('Error tracking location');
                },
                { enableHighAccuracy: true }
            );
        }
    };

    const startStream = async () => {
        try {
            const constraints = {
                video: {
                    facingMode: isFrontCamera ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;
            
            // Create and configure peer connection
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Add local stream tracks to peer connection
            stream.getTracks().forEach(track => {
                peerConnection.addTrack(track, stream);
            });

            // Set up local video
            videoRef.current.srcObject = stream;
            videoRef.current.style.order = "1"; // Place local video at the top
            setIsStreaming(true);

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            // Send the offer to the supervisor through socket
            socket.emit('streamOffer', {
                investigationId,
                offer: peerConnection.localDescription
            });

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('iceCandidate', {
                        investigationId,
                        candidate: event.candidate
                    });
                }
            };

            // Store peer connection reference
            peerConnectionRef.current = peerConnection;

        } catch (error) {
            console.error('Error starting stream:', error);
            toast.error('Error starting camera stream');
        }
    };

    useEffect(() => {
        socket.on('streamAnswer', async ({ answer }) => {
            try {
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                }
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        });

        socket.on('iceCandidate', async ({ candidate }) => {
            try {
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });

        return () => {
            socket.off('streamAnswer');
            socket.off('iceCandidate');
        };
    }, [socket]);

    const stopStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
            videoRef.current.srcObject = null;
            setIsStreaming(false);
        }
    };

    const toggleCamera = async () => {
        stopStream();
        setIsFrontCamera(!isFrontCamera);
        await startStream();
    };

    const handleNewMessage = (message) => {
        setMessages(prev => [...prev, message]);
    };

    const handleFrontCameraRequest = () => {
        toast.info('Supervisor requested front camera');
        if (!isFrontCamera) {
            toggleCamera();
        }
    };

    const handleStreamQualityUpdate = (quality) => {
        setStreamQuality(quality);
        if (quality === 'poor') {
            toast.warning('Poor stream quality detected');
        }
    };

    const sendMessage = () => {
        if (!newMessage.trim()) return;
        
        socket.emit('message', {
            investigationId,
            content: newMessage,
            sender: user.username
        });
        
        setNewMessage('');
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-3 gap-6">
                {/* Main Stream View */}
                <div className="col-span-2 bg-white p-4 rounded-lg shadow-md">
                    <div className="aspect-w-16 aspect-h-9 mb-4">
                        <video
                            ref={videoRef}
                            className="w-full h-full rounded-lg"
                            autoPlay
                            playsInline
                            muted
                        />
                    </div>
                    
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-xl font-semibold">
                                Investigation: {investigation?.claim?.policyNumber}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span className={`flex items-center ${
                                    streamQuality === 'good' ? 'text-green-600' :
                                    streamQuality === 'fair' ? 'text-yellow-600' :
                                    'text-red-600'
                                }`}>
                                    <div className={`w-2 h-2 rounded-full mr-2 ${
                                        streamQuality === 'good' ? 'bg-green-600' :
                                        streamQuality === 'fair' ? 'bg-yellow-600' :
                                        'bg-red-600'
                                    }`} />
                                    Stream Quality: {streamQuality}
                                </span>
                                <span>
                                    Camera: {isFrontCamera ? 'Front' : 'Back'}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex space-x-4">
                            {!isStreaming ? (
                                <button
                                    onClick={startStream}
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                >
                                    Start Stream
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={toggleCamera}
                                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                    >
                                        Switch Camera
                                    </button>
                                    <button
                                        onClick={stopStream}
                                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                    >
                                        Stop Stream
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chat and Info Panel */}
                <div className="col-span-1 space-y-4">
                    {/* Investigation Info */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h4 className="font-semibold mb-2">Investigation Details</h4>
                        {investigation && (
                            <div className="space-y-2 text-sm">
                                <p>
                                    <span className="font-medium">Claim ID:</span> {investigation.claim.id}
                                </p>
                                <p>
                                    <span className="font-medium">Vehicle:</span>
                                    {' '}{investigation.claim.vehicleInfo.make}
                                    {' '}{investigation.claim.vehicleInfo.model}
                                    {' '}({investigation.claim.vehicleInfo.year})
                                </p>
                                <p>
                                    <span className="font-medium">Location:</span>
                                    {' '}{investigation.claim.claimDetails.location}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Team Chat */}
                    <div className="bg-white p-4 rounded-lg shadow-md flex flex-col h-[400px]">
                        <h4 className="font-semibold mb-2">Team Chat</h4>
                        
                        <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`p-2 rounded ${
                                        message.sender === user.username
                                            ? 'bg-blue-100 ml-auto'
                                            : 'bg-gray-100'
                                    } max-w-[80%]`}
                                >
                                    <div className="text-xs text-gray-600 mb-1">
                                        {message.sender}
                                    </div>
                                    <div>{message.content}</div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Type a message..."
                                className="flex-1 p-2 border rounded"
                            />
                            <button
                                onClick={sendMessage}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Investigation;
