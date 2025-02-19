import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const API_URL = import.meta.env.VITE_API_URL;

const LiveMonitoring = () => {
    const [activeStreams, setActiveStreams] = useState([]);
    const [selectedStream, setSelectedStream] = useState(null);
    const [officers, setOfficers] = useState([]);
    const [loading, setLoading] = useState(false);
    const videoRef = useRef(null);
    const { socket, trackActivity } = useSocket();
    const { user } = useAuth();

    const [peerConnections, setPeerConnections] = useState({});
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    useEffect(() => {
        fetchActiveStreams();
        fetchOfficers();

        // Socket event listeners
        socket.on('streamStarted', handleStreamStarted);
        socket.on('streamEnded', handleStreamEnded);
        socket.on('locationUpdate', handleLocationUpdate);
        socket.on('streamData', handleStreamData);

        // Handle incoming stream offers
        socket.on('streamOffer', async ({ investigationId, offer }) => {
            try {
                // Create new peer connection
                const peerConnection = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                });

                // Store peer connection
                setPeerConnections(prev => ({
                    ...prev,
                    [investigationId]: peerConnection
                }));

                // Set up local stream for supervisor's camera
                const localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                localStreamRef.current = localStream;
                localVideoRef.current.srcObject = localStream;
                localVideoRef.current.style.order = "2"; // Place supervisor video at the bottom

                // Add local tracks to peer connection
                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                });

                // Handle remote stream
                peerConnection.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        remoteVideoRef.current.style.order = "1"; // Place remote video at the top
                    }
                };

                // Handle ICE candidates
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('iceCandidate', {
                            investigationId,
                            candidate: event.candidate
                        });
                    }
                };

                // Set remote description (offer)
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

                // Create and send answer
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.emit('streamAnswer', {
                    investigationId,
                    answer: peerConnection.localDescription
                });

            } catch (error) {
                console.error('Error handling stream offer:', error);
                toast.error('Error establishing video connection');
            }
        });

        socket.on('iceCandidate', async ({ investigationId, candidate }) => {
            try {
                const peerConnection = peerConnections[investigationId];
                if (peerConnection) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });

        return () => {
            socket.off('streamStarted', handleStreamStarted);
            socket.off('streamEnded', handleStreamEnded);
            socket.off('locationUpdate', handleLocationUpdate);
            socket.off('streamData', handleStreamData);
            socket.off('streamOffer');
            socket.off('iceCandidate');
            // Clean up local stream
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            // Clean up peer connections
            Object.values(peerConnections).forEach(pc => pc.close());
        };
    }, [socket, peerConnections]);

    const fetchActiveStreams = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/streams/active`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch active streams');
            }

            const data = await response.json();
            setActiveStreams(data);
            
            // Track activity
            trackActivity('STREAMS_FETCHED', { count: data.length });
        } catch (error) {
            console.error('Error fetching active streams:', error);
            toast.error('Error fetching active streams');
        } finally {
            setLoading(false);
        }
    };

    const fetchOfficers = async () => {
        try {
            const response = await fetch(`${API_URL}/api/users/officers`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch officers');
            }

            const data = await response.json();
            setOfficers(data);
        } catch (error) {
            console.error('Error fetching officers:', error);
            toast.error('Error fetching officers');
        }
    };

    const handleStreamStarted = (data) => {
        setActiveStreams(prev => [...prev, data]);
        toast.info(`New stream started by ${data.officerName}`);
        trackActivity('STREAM_STARTED_NOTIFICATION', { streamId: data.id });
    };

    const handleStreamEnded = (streamId) => {
        setActiveStreams(prev => prev.filter(stream => stream.id !== streamId));
        if (selectedStream?.id === streamId) {
            setSelectedStream(null);
        }
        toast.info('Stream ended');
        trackActivity('STREAM_ENDED_NOTIFICATION', { streamId });
    };

    const handleLocationUpdate = (data) => {
        setActiveStreams(prev => prev.map(stream => 
            stream.id === data.streamId 
                ? { ...stream, location: data.location }
                : stream
        ));
    };

    const handleStreamData = (data) => {
        if (selectedStream?.id === data.streamId && videoRef.current) {
            // Handle incoming stream data (e.g., WebRTC or video chunks)
            console.log('Received stream data:', data);
        }
    };

    const handleStreamSelect = (stream) => {
        setSelectedStream(stream);
        trackActivity('STREAM_SELECTED', { streamId: stream.id });
    };

    const handleSendMessage = (streamId, message) => {
        if (socket) {
            socket.emit('stream:message', { streamId, message });
            trackActivity('MESSAGE_SENT', { streamId, message });
        }
    };

    return (
        <div className="live-monitoring-container">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Active Streams List */}
                <div className="md:col-span-1">
                    <h2 className="text-2xl font-bold mb-4">Active Streams</h2>
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                        <ul className="divide-y divide-gray-200">
                            {loading ? (
                                <li className="p-4 text-center text-gray-500">Loading streams...</li>
                            ) : activeStreams.length === 0 ? (
                                <li className="p-4 text-center text-gray-500">No active streams</li>
                            ) : (
                                activeStreams.map(stream => (
                                    <li 
                                        key={stream.id}
                                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                                            selectedStream?.id === stream.id ? 'bg-blue-50' : ''
                                        }`}
                                        onClick={() => handleStreamSelect(stream)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-medium text-gray-900">
                                                    {stream.officerName}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    {stream.location}
                                                </p>
                                            </div>
                                            <div className="flex items-center">
                                                <span className="h-2.5 w-2.5 rounded-full bg-green-400 mr-2"></span>
                                                <span className="text-sm text-gray-500">Live</span>
                                            </div>
                                        </div>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>

                {/* Stream View */}
                <div className="md:col-span-2">
                    {selectedStream ? (
                        <div className="bg-white shadow rounded-lg p-4">
                            <div className="video-container">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="remote-video"
                                />
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="local-video"
                                />
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-medium">
                                        {selectedStream.officerName}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {selectedStream.location}
                                    </p>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleSendMessage(selectedStream.id, 'Please check this area')}
                                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Send Message
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white shadow rounded-lg p-8 text-center">
                            <h3 className="text-lg font-medium text-gray-500">
                                Select a stream to view
                            </h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveMonitoring;
