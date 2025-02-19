import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

const StreamParticipation = () => {
    const [activeInvitations, setActiveInvitations] = useState([]);
    const [joinedStreams, setJoinedStreams] = useState([]);
    const [selectedStream, setSelectedStream] = useState(null);
    const [notes, setNotes] = useState('');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    
    const socket = useSocket();
    const { user } = useAuth();

    useEffect(() => {
        fetchActiveInvitations();
        fetchJoinedStreams();

        socket.on('newInvitation', handleNewInvitation);
        socket.on('streamEnded', handleStreamEnded);
        socket.on('message', handleNewMessage);

        return () => {
            socket.off('newInvitation', handleNewInvitation);
            socket.off('streamEnded', handleStreamEnded);
            socket.off('message', handleNewMessage);
        };
    }, []);

    const fetchActiveInvitations = async () => {
        try {
            const response = await fetch('/api/streams/invitations', {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            const data = await response.json();
            setActiveInvitations(data);
        } catch (error) {
            toast.error('Error fetching invitations');
        }
    };

    const fetchJoinedStreams = async () => {
        try {
            const response = await fetch('/api/streams/joined', {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            const data = await response.json();
            setJoinedStreams(data);
        } catch (error) {
            toast.error('Error fetching joined streams');
        }
    };

    const handleNewInvitation = (invitation) => {
        setActiveInvitations(prev => [...prev, invitation]);
        toast.info(`New investigation invitation from ${invitation.supervisor.name}`);
    };

    const handleStreamEnded = (streamId) => {
        setJoinedStreams(prev => prev.filter(s => s.id !== streamId));
        if (selectedStream?.id === streamId) {
            setSelectedStream(null);
            toast.info('Current investigation stream has ended');
        }
    };

    const handleNewMessage = (message) => {
        if (selectedStream?.id === message.streamId) {
            setMessages(prev => [...prev, message]);
        }
    };

    const handleJoinStream = async (streamId) => {
        try {
            const response = await fetch(`/api/streams/${streamId}/join`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (response.ok) {
                const streamData = await response.json();
                setJoinedStreams(prev => [...prev, streamData]);
                setActiveInvitations(prev => prev.filter(i => i.streamId !== streamId));
                toast.success('Joined investigation stream');
            }
        } catch (error) {
            toast.error('Error joining stream');
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedStream || !notes.trim()) return;

        try {
            const response = await fetch(`/api/streams/${selectedStream.id}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    notes,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                toast.success('Investigation notes saved');
                setNotes('');
            }
        } catch (error) {
            toast.error('Error saving notes');
        }
    };

    const sendMessage = () => {
        if (!selectedStream || !newMessage.trim()) return;
        
        socket.emit('message', {
            streamId: selectedStream.id,
            content: newMessage,
            sender: user.username
        });
        
        setNewMessage('');
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-3 gap-6">
                {/* Streams List */}
                <div className="col-span-1">
                    {/* Active Invitations */}
                    {activeInvitations.length > 0 && (
                        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                            <h3 className="text-xl font-semibold mb-4">New Invitations</h3>
                            <div className="space-y-4">
                                {activeInvitations.map((invitation) => (
                                    <div
                                        key={invitation.streamId}
                                        className="p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                                    >
                                        <div className="font-semibold mb-2">
                                            From: {invitation.supervisor.name}
                                        </div>
                                        <div className="text-sm text-gray-600 mb-2">
                                            Claim ID: {invitation.claimId}
                                        </div>
                                        <button
                                            onClick={() => handleJoinStream(invitation.streamId)}
                                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        >
                                            Join Investigation
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Joined Streams */}
                    <div className="bg-white p-4 rounded-lg shadow-md">
                        <h3 className="text-xl font-semibold mb-4">Active Investigations</h3>
                        <div className="space-y-4">
                            {joinedStreams.map((stream) => (
                                <div
                                    key={stream.id}
                                    className={`p-4 rounded-lg cursor-pointer transition-colors ${
                                        selectedStream?.id === stream.id
                                            ? 'bg-blue-100 border-blue-500'
                                            : 'bg-gray-50 hover:bg-gray-100'
                                    }`}
                                    onClick={() => setSelectedStream(stream)}
                                >
                                    <div className="font-semibold">
                                        Investigator: {stream.investigator.name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Claim ID: {stream.claimId}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Duration: {stream.duration}
                                    </div>
                                </div>
                            ))}
                            
                            {joinedStreams.length === 0 && (
                                <div className="text-center py-4 text-gray-600">
                                    No active investigations
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="col-span-2">
                    {selectedStream ? (
                        <div className="space-y-6">
                            {/* Stream View */}
                            <div className="bg-white p-4 rounded-lg shadow-md">
                                <div className="aspect-w-16 aspect-h-9 mb-4">
                                    <video
                                        className="w-full h-full rounded-lg"
                                        autoPlay
                                        playsInline
                                    />
                                </div>
                                
                                <div className="mb-4">
                                    <h3 className="text-xl font-semibold">
                                        Investigation: {selectedStream.claim?.policyNumber}
                                    </h3>
                                    <p className="text-gray-600">
                                        Investigator: {selectedStream.investigator.name}
                                    </p>
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="bg-white p-4 rounded-lg shadow-md">
                                <h4 className="font-semibold mb-2">Investigation Notes</h4>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add your professional insights and observations..."
                                    className="w-full p-2 border rounded mb-2"
                                    rows="4"
                                />
                                <button
                                    onClick={handleSaveNotes}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    Save Notes
                                </button>
                            </div>

                            {/* Team Chat */}
                            <div className="bg-white p-4 rounded-lg shadow-md">
                                <h4 className="font-semibold mb-2">Team Chat</h4>
                                <div className="h-[200px] overflow-y-auto mb-4 space-y-2">
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
                    ) : (
                        <div className="bg-white p-8 rounded-lg shadow-md text-center">
                            <p className="text-gray-600">
                                Select an active investigation to view details
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StreamParticipation;
