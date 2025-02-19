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

    const socketInstance = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token: user.token },  // Use token from user object
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    // Connection events
    socketInstance.on('connect', () => {
      logWithTimestamp(`Socket connected successfully`, {
        socketId: socketInstance.id,
        userId: user.id,
        role: user.role
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
      logWithTimestamp(`Socket connection error`, { 
        error: error.message,
        userId: user.id
      });
      setIsConnected(false);
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
      if (socketInstance && isConnected) {
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
      'CLAIM_STATUS_CHANGED'
    ];

    if (socket && isConnected && importantActivities.includes(action)) {
      logWithTimestamp('Tracking important activity', { action, details });
      socket.emit('activity', { type: action, content: details });
    } else if (!socket || !isConnected) {
      logWithTimestamp('Cannot track activity - socket not connected', { action, details });
    }
  }, [socket, isConnected]);

  const joinStream = useCallback((streamId) => {
    if (socket && isConnected) {
      logWithTimestamp('Joining stream', { streamId });
      socket.emit('stream:join', { streamId });
    }
  }, [socket, isConnected]);

  const leaveStream = useCallback((streamId) => {
    if (socket && isConnected) {
      logWithTimestamp('Leaving stream', { streamId });
      socket.emit('stream:leave', { streamId });
    }
  }, [socket, isConnected]);

  const startStream = useCallback((streamDetails) => {
    if (socket && isConnected) {
      logWithTimestamp('Starting stream', streamDetails);
      socket.emit('stream:start', streamDetails);
    }
  }, [socket, isConnected]);

  const endStream = useCallback((streamId) => {
    if (socket && isConnected) {
      logWithTimestamp('Ending stream', { streamId });
      socket.emit('stream:end', { streamId });
    }
  }, [socket, isConnected]);

  const sendStreamMessage = useCallback((streamId, message) => {
    if (socket && isConnected) {
      logWithTimestamp('Sending stream message', { streamId, message });
      socket.emit('stream:message', { streamId, message });
    }
  }, [socket, isConnected]);

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
