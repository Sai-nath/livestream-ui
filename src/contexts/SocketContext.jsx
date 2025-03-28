import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

// Helper function for formatted logs
const logWithTimestamp = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] SOCKET CLIENT: ${message}`, data ? data : '');
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activities, setActivities] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const { user } = useAuth();  // We only need user from auth context

  useEffect(() => {
    // Clean up previous socket connection
    if (socket) {
      logWithTimestamp('Cleaning up previous socket connection');
      socket.disconnect();
      setSocket(null);
    }

    if (!user?.token || !user?.id) {
      logWithTimestamp('No token or user ID available, skipping socket connection', { 
        hasToken: !!user?.token, 
        userId: user?.id 
      });
      return;
    }

    logWithTimestamp('Initializing socket connection', { 
      userId: user.id,
      role: user.role
    });

    // Get the base URL based on the current environment
    const getBaseUrl = () => {
      const networkUrl = import.meta.env.VITE_API_URL;
      const allowLocal = import.meta.env.VITE_ALLOW_LOCAL === 'true';
      const isLocalhost = window.location.hostname === 'localhost';
      const baseUrl = isLocalhost && allowLocal ? 'http://localhost:5000' : networkUrl;
      logWithTimestamp('Using socket base URL:', baseUrl);
      return baseUrl;
    };

    const socketInstance = io(getBaseUrl(), {
      auth: { token: user.token },
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      withCredentials: false,
      path: '/socket.io',
      autoConnect: true,
      forceNew: true
    });

    // Enhanced socket connection logging
    console.log(`Socket Connection Details:`, {
      baseUrl: getBaseUrl(),
      fullUri: socketInstance.io.uri,
      transport: socketInstance.io.engine?.transport?.name || 'initializing',
      authToken: user.token ? 'Present' : 'Missing',
      userId: user.id,
      networkIP: '192.168.8.150'
    });

    // Connection event logging
    socketInstance.io.engine.on('open', () => {
      console.log('Socket Engine Opened:', {
        url: socketInstance.io.uri,
        transport: socketInstance.io.engine.transport.name
      });
    });

    socketInstance.io.engine.on('close', (reason) => {
      console.log('Socket Engine Closed:', {
        reason: reason,
        url: socketInstance.io.uri
      });
    });

    console.log(`Socket URL: ${socketInstance.io.uri}`);
    // Connection events
    socketInstance.on('connect', () => {
      logWithTimestamp(`Socket connected successfully`, {
        socketId: socketInstance.id,
        userId: user.id,
        role: user.role,
        connectionUrl: socketInstance.io.uri
      });
      setIsConnected(true);
      setReconnectAttempts(0);
      
      // Emit user's role for proper room assignment
      logWithTimestamp(`Emitting userConnected event`, { 
        userId: user.id, 
        role: user.role 
      });
      socketInstance.emit('userConnected', { 
        userId: user.id,
        role: user.role
      });
    });

    socketInstance.on('disconnect', () => {
      logWithTimestamp(`Socket disconnected`, { 
        reason: 'disconnected',
        userId: user.id
      });
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      logWithTimestamp('Socket connection error', { error: error.message, userId: user.id });
      setIsConnected(false);
      setReconnectAttempts((prev) => prev + 1);
    });

    socketInstance.on('error', (error) => {
      logWithTimestamp(`Socket error`, { 
        error: error.message,
        userId: user.id
      });
    });

    // Reconnection events
    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      logWithTimestamp(`Reconnection attempt ${attemptNumber}`, { 
        userId: user.id
      });
      setReconnectAttempts(attemptNumber);
    });

    socketInstance.on('reconnect', () => {
      logWithTimestamp(`Socket reconnected`, { 
        userId: user.id
      });
      setIsConnected(true);
      setReconnectAttempts(0);
    });

    socketInstance.on('reconnect_error', (error) => {
      logWithTimestamp(`Reconnection error`, { 
        error: error.message,
        userId: user.id
      });
    });

    socketInstance.on('reconnect_failed', () => {
      logWithTimestamp(`Reconnection failed`, { 
        userId: user.id
      });
      // Optionally show a message to the user that they need to refresh
    });

    // Keep-alive ping
    const pingInterval = setInterval(() => {
      if (socketInstance && socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 30000);

    // Handle online users updates
    socketInstance.on('onlineUsers', (users) => {
      logWithTimestamp(`Received online users list`, { 
        users,
        count: users.length
      });
      setOnlineUsers(new Set(users));
    });

    // Handle user status changes
    socketInstance.on('userStatusChange', ({ userId, status, timestamp }) => {
      logWithTimestamp(`User status change`, { 
        userId,
        status,
        timestamp: new Date(timestamp).toISOString()
      });
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (status === 'online') {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    });

    // Handle activity updates
    socketInstance.on('activity', (activity) => {
      logWithTimestamp(`Received activity`, {
        type: activity.type,
        from: activity.userId,
        timestamp: new Date(activity.timestamp).toISOString()
      });
      setActivities(prev => [...prev, activity].slice(-100));
    });

    setSocket(socketInstance);

    return () => {
      clearInterval(pingInterval);
      if (socketInstance) {
        logWithTimestamp('Cleaning up socket connection', { userId: user.id });
        socketInstance.disconnect();
      }
    };
  }, [user?.id, user?.token]); // Depend on both user.id and user.token

  // Socket event functions
  const trackActivity = useCallback((action, details) => {
    // Only track important activities
    const importantActivities = [
      'STREAM_STARTED',
      'STREAM_ENDED',
      'CLAIM_CREATED',
      'CLAIM_ASSIGNED',
      'CLAIM_STATUS_CHANGED',
      'CLAIMS_FETCHED'
    ];

    // Check if socket exists and is connected
    const socketConnected = socket && socket.connected;
    
    if (socketConnected && importantActivities.includes(action)) {
      logWithTimestamp('Tracking activity', { 
        action, 
        details,
        socketId: socket.id,
        networkIP: '192.168.8.150' // Using the known network IP
      });
      socket.emit('activity', { type: action, content: details });
    } else if (!socketConnected) {
      // Queue activity for when connection is restored
      logWithTimestamp('Socket not connected for activity tracking', { 
        action, 
        details,
        socketExists: !!socket,
        socketConnected: socket?.connected,
        networkIP: '192.168.8.150'
      });
      
      // If socket exists but is disconnected, set up a one-time handler for reconnection
      if (socket) {
        const onReconnect = () => {
          logWithTimestamp('Sending queued activity after reconnection', { action, details });
          socket.emit('activity', { type: action, content: details });
          socket.off('connect', onReconnect);
        };
        
        socket.once('connect', onReconnect);
      }
    }
  }, [socket]);

  const joinStream = useCallback((streamId) => {
    const socketConnected = socket && socket.connected;
    
    if (socketConnected) {
      logWithTimestamp('Joining stream', { 
        streamId,
        socketId: socket.id,
        networkIP: '192.168.8.150' // Using the known network IP
      });
      socket.emit('stream:join', { streamId });
    } else {
      logWithTimestamp('Cannot join stream - socket not connected', { 
        streamId,
        socketExists: !!socket,
        socketConnected: socket?.connected,
        networkIP: '192.168.8.150'
      });
    }
  }, [socket]);

  const leaveStream = useCallback((streamId) => {
    const socketConnected = socket && socket.connected;
    
    if (socketConnected) {
      logWithTimestamp('Leaving stream', { 
        streamId,
        socketId: socket.id,
        networkIP: '192.168.8.150'
      });
      socket.emit('stream:leave', { streamId });
    } else {
      logWithTimestamp('Cannot leave stream - socket not connected', { 
        streamId,
        socketExists: !!socket,
        socketConnected: socket?.connected,
        networkIP: '192.168.8.150'
      });
    }
  }, [socket]);

  const startStream = useCallback((streamDetails) => {
    const socketConnected = socket && socket.connected;
    
    if (socketConnected) {
      logWithTimestamp('Starting stream', {
        ...streamDetails,
        socketId: socket.id,
        networkIP: '192.168.8.150'
      });
      socket.emit('stream:start', streamDetails);
    } else {
      logWithTimestamp('Cannot start stream - socket not connected', { 
        streamDetails,
        socketExists: !!socket,
        socketConnected: socket?.connected,
        networkIP: '192.168.8.150'
      });
    }
  }, [socket]);

  const endStream = useCallback((streamId) => {
    const socketConnected = socket && socket.connected;
    
    if (socketConnected) {
      logWithTimestamp('Ending stream', { 
        streamId,
        socketId: socket.id,
        networkIP: '192.168.8.150'
      });
      socket.emit('stream:end', { streamId });
    } else {
      logWithTimestamp('Cannot end stream - socket not connected', { 
        streamId,
        socketExists: !!socket,
        socketConnected: socket?.connected,
        networkIP: '192.168.8.150'
      });
    }
  }, [socket]);

  const sendStreamMessage = useCallback((streamId, message) => {
    const socketConnected = socket && socket.connected;
    
    if (socketConnected) {
      logWithTimestamp('Sending stream message', { 
        streamId, 
        message,
        socketId: socket.id,
        networkIP: '192.168.8.150'
      });
      socket.emit('stream:message', { streamId, message });
    } else {
      logWithTimestamp('Cannot send stream message - socket not connected', { 
        streamId,
        messageLength: message?.length,
        socketExists: !!socket,
        socketConnected: socket?.connected,
        networkIP: '192.168.8.150'
      });
    }
  }, [socket]);

  const value = {
    socket,
    isConnected,
    activities,
    onlineUsers: Array.from(onlineUsers),
    reconnectAttempts,
    maxAttempts: MAX_RECONNECT_ATTEMPTS,
    trackActivity,
    joinStream,
    leaveStream,
    startStream,
    endStream,
    sendStreamMessage,
    reconnect: () => {
      if (socket) {
        socket.connect();
      }
    }
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
