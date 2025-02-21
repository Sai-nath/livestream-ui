import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  FaCamera,
  FaCameraRetro,
  FaPhoneSlash,
  FaImage,
  FaComment,
  FaMicrophone,
  FaMicrophoneSlash,
  FaLightbulb,
  FaVideo,
  FaVideoSlash,
  FaDownload,
  FaCog,
  FaSyncAlt,
  FaExclamationTriangle
} from "react-icons/fa";
import { TiMessages } from "react-icons/ti";
import {
  uploadScreenshot,
  uploadRecording,
  startRecording,
  getPresignedUploadUrl,
  calculateStorageUsage,
  getDownloadUrl
} from "../../utils/awss3storage";
import "./VideoCall.css";

const VideoCall = ({ socket, role, callId, onEndCall, claimNumber }) => {
  // State variables
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isBackCamera, setIsBackCamera] = useState(role === "investigator");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [hasMediaPermissions, setHasMediaPermissions] = useState(false);
  const [isCallInitialized, setIsCallInitialized] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({
    uploading: false,
    progress: 0,
    type: null,
    fileName: null
  });
  const [callStats, setCallStats] = useState({
    duration: 0,
    bytesTransferred: 0,
    resolution: "",
    bandwidth: 0,
    connectionQuality: "unknown"
  });
  const [availableDevices, setAvailableDevices] = useState({
    cameras: [],
    microphones: []
  });
  const [showSettings, setShowSettings] = useState(false);
  const [connectionState, setConnectionState] = useState("new");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [remoteCameraActive, setRemoteCameraActive] = useState(true);
  
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const recordingStateRef = useRef(null);
  const callTimerRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const pingIntervalRef = useRef(null);
  const noRemoteVideoTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const autoReconnectIntervalRef = useRef(null);
  const iceCandidatesRef = useRef([]);
  const lastIceGatheringTime = useRef(Date.now());
  const mediaConstraintsRef = useRef({
    video: {
      facingMode: isBackCamera ? "environment" : "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  // WebRTC configuration - with additional STUN and TURN servers
  const configuration = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
      { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
      { urls: ["stun:stun4.l.google.com:19302", "stun:stun.stunprotocol.org:3478"] },
      {
        urls: "turn:global.turn.twilio.com:3478?transport=udp",
        username: "your_twilio_username", // Replace with actual credentials from env vars
        credential: "your_twilio_credential"
      },
      {
        urls: "turn:global.turn.twilio.com:3478?transport=tcp",
        username: "your_twilio_username", // Replace with actual credentials from env vars
        credential: "your_twilio_credential"
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    sdpSemantics: "unified-plan",
    iceTransportPolicy: "all" // try "relay" if direct connections fail
  };

  // Function to log with context for easier debugging
  const logWithContext = (message, data = null) => {
    const context = `[${role}:${callId.slice(-4)}]`;
    if (data) {
      console.log(`${context} ${message}`, data);
    } else {
      console.log(`${context} ${message}`);
    }
  };

  // Handle incoming socket events
  useEffect(() => {
    if (!socket) return;

    // Setup regular ping to keep socket connection alive
    const setupPingInterval = () => {
      pingIntervalRef.current = setInterval(() => {
        socket.emit('ping', { callId, timestamp: Date.now() });
      }, 15000); // Send ping every 15 seconds
    };
    
    setupPingInterval();

    const handleUserDisconnected = ({ userId }) => {
      logWithContext("User disconnected:", userId);
      toast.warning("Participant disconnected. They may rejoin shortly.");
    };

    const handleCallEnded = () => {
      logWithContext("Call ended by peer");
      cleanupCall();
      onEndCall();
    };

    const handleParticipantRejoined = ({ role: rejoiningRole }) => {
      logWithContext("Participant rejoined:", rejoiningRole);
      toast.info(`${rejoiningRole} has rejoined the call`);
      
      // If we have a pending reconnection timeout, clear it
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      // If we're the supervisor and the investigator rejoined, 
      // send video offer to establish connection
      if (role === "supervisor" && rejoiningRole === "investigator" && peerConnectionRef.current) {
        setTimeout(async () => {
          try {
            const offer = await peerConnectionRef.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true
            });
            await peerConnectionRef.current.setLocalDescription(offer);
            socket.emit("video_offer", { callId, offer });
            logWithContext("Sent new offer after participant rejoined");
          } catch (error) {
            logWithContext("Error creating offer after rejoin:", error);
          }
        }, 1000); // Small delay to ensure the other side is ready
      }
    };

    const handlePing = ({ timestamp }) => {
      // Respond to ping to confirm connection is active
      socket.emit('pong', { callId, originalTimestamp: timestamp, respondedAt: Date.now() });
    };

    const handlePong = ({ originalTimestamp, respondedAt }) => {
      // Calculate round-trip time
      const rtt = Date.now() - originalTimestamp;
      logWithContext(`Connection RTT: ${rtt}ms`);
      
      // If RTT is very high, warn about potential connection issues
      if (rtt > 1000) {
        toast.warn("Network latency is high. Call quality may be affected.");
      }
    };

    const handleRecordingStatus = async ({
      isRecording: remoteRecording,
      startedBy,
      stoppedBy,
      timestamp
    }) => {
      logWithContext(
        `Recording status update: ${remoteRecording ? "started" : "stopped"}`
      );

      if (remoteRecording) {
        // Recording started
        toast.info(`Recording started by ${startedBy}`);

        // If I'm the investigator and supervisor started recording
        if (
          role === "investigator" &&
          startedBy === "supervisor" &&
          !isRecording
        ) {
          try {
            // Start actual recording on investigator device
            const stream = localVideoRef.current?.srcObject;
            if (!stream) {
              const errorMsg = "No video stream available to record";
              logWithContext(errorMsg);
              toast.error(errorMsg);

              // Notify supervisor of failure with specific reason
              socket.emit("recording_error", {
                callId,
                error: { message: errorMsg }
              });
              return;
            }

            // Check for video tracks
            if (stream.getVideoTracks().length === 0) {
              const errorMsg = "No video track available to record";
              logWithContext(errorMsg);
              toast.error(errorMsg);
              socket.emit("recording_error", {
                callId,
                error: { message: errorMsg }
              });
              return;
            }

            logWithContext(
              "Starting recording with stream:",
              stream.id,
              "tracks:",
              stream
                .getTracks()
                .map(t => t.kind)
                .join(",")
            );

            // Start recording with enhanced options
            recordingStateRef.current = await startRecording(
              claimNumber,
              callId,
              stream,
              {
                onProgressUpdate: progress => {
                  setUploadStatus({
                    uploading: true,
                    progress,
                    type: "recording",
                    fileName: `call-${callId}-${new Date()
                      .toISOString()
                      .slice(0, 10)}.webm`
                  });
                }
              }
            );

            setIsRecording(true);
          } catch (error) {
            const errorMsg = `Failed to start recording on investigator device: ${error.message ||
              "Unknown error"}`;
            logWithContext(errorMsg, error);
            toast.error("Failed to start recording");

            // Notify supervisor of failure
            socket.emit("recording_error", {
              callId,
              error: { message: errorMsg }
            });
          }
        } else if (!isRecording) {
          // Update UI for non-recording participant
          setIsRecording(true);
        }
      } else {
        // Recording stopped
        toast.info(`Recording stopped by ${stoppedBy}`);

        // If I'm the investigator and have an active recording
        if (role === "investigator" && recordingStateRef.current) {
          try {
            // Stop recording and upload
            const blobUrl = await recordingStateRef.current.stopRecording();

            if (blobUrl) {
              setRecordingUrl(blobUrl);

              // Notify all participants that recording is available
              socket.emit("recording_completed", {
                callId,
                recordingUrl: blobUrl,
                recordedBy: role,
                timestamp: new Date().toISOString()
              });
            } else {
              logWithContext("Recording stopped but no blob URL was returned");
            }

            // Reset recording state
            recordingStateRef.current = null;
          } catch (error) {
            const errorMsg = `Error stopping recording after remote request: ${error.message ||
              "Unknown error"}`;
            logWithContext(errorMsg, error);
            toast.error("Failed to save recording");

            // Notify others of failure
            socket.emit("recording_error", {
              callId,
              error: { message: errorMsg }
            });
          }
        }

        // Always update UI
        setIsRecording(false);
        setUploadStatus(prev => ({ ...prev, uploading: false, progress: 0 }));
      }
    };

    const handleRecordingError = ({ message }) => {
      toast.error(`Recording error: ${message}`);

      // Reset local recording state
      setIsRecording(false);
      if (recordingStateRef.current) {
        try {
          // Try to stop any ongoing recording
          recordingStateRef.current
            .stopRecording()
            .catch(err =>
              logWithContext("Failed to stop recording after error:", err)
            );
          recordingStateRef.current = null;
        } catch (err) {
          logWithContext("Error cleaning up recording after error:", err);
        }
      }

      setUploadStatus({
        uploading: false,
        progress: 0,
        type: null,
        fileName: null
      });
    };

    const handleRecordingAvailable = ({
      recordingUrl,
      recordedBy,
      timestamp
    }) => {
      toast.success(`Recording is now available from ${recordedBy}`);

      // Add to messages so it can be accessed later
      setMessages(prev => [
        ...prev,
        {
          type: "recording",
          url: recordingUrl,
          timestamp,
          recordedBy,
          message: `Recording from ${new Date(timestamp).toLocaleString()}`,
          isLocal: recordedBy === role
        }
      ]);
    };

    const handleConnectionQuality = ({ quality, stats }) => {
      // Update connection quality stats
      setCallStats(prev => ({
        ...prev,
        connectionQuality: quality,
        ...stats
      }));

      // Notify user if quality is poor
      if (quality === "poor" && callStats.connectionQuality !== "poor") {
        toast.warn("Connection quality is poor. Video may be degraded.");
      }
    };

    const handleVideoStateChange = ({ isVideoOff: remoteVideoOff }) => {
      logWithContext(`Remote participant video state changed: ${remoteVideoOff ? 'off' : 'on'}`);
      setRemoteCameraActive(!remoteVideoOff);
    };

    socket.on("user_disconnected", handleUserDisconnected);
    socket.on("call_ended", handleCallEnded);
    socket.on("participant_rejoined", handleParticipantRejoined);
    socket.on("recording_status", handleRecordingStatus);
    socket.on("recording_error", handleRecordingError);
    socket.on("recording_available", handleRecordingAvailable);
    socket.on("connection_quality", handleConnectionQuality);
    socket.on("ping", handlePing);
    socket.on("pong", handlePong);
    socket.on("participant_video_state", handleVideoStateChange);

    // Cleanup socket listeners
    return () => {
      socket.off("user_disconnected", handleUserDisconnected);
      socket.off("call_ended", handleCallEnded);
      socket.off("participant_rejoined", handleParticipantRejoined);
      socket.off("recording_status", handleRecordingStatus);
      socket.off("recording_error", handleRecordingError);
      socket.off("recording_available", handleRecordingAvailable);
      socket.off("connection_quality", handleConnectionQuality);
      socket.off("ping", handlePing);
      socket.off("pong", handlePong);
      socket.off("participant_video_state", handleVideoStateChange);
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [
    socket,
    isRecording,
    role,
    claimNumber,
    callId,
    callStats.connectionQuality
  ]);

  // Get geolocation if investigator and share it periodically
  useEffect(() => {
    if (role === "investigator" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        position => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };
          setCurrentLocation(locationData);

          // Share location with supervisor every 10 seconds
          if (socket && isCallInitialized) {
            socket.emit("location_update", {
              callId,
              location: locationData,
              timestamp: new Date().toISOString()
            });
          }
        },
        error => {
          logWithContext("Geolocation error:", error);
          toast.warning(
            "Unable to access location. Some features may be limited."
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 27000
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [role, socket, isCallInitialized, callId]);

  // Call timer to track duration
  useEffect(() => {
    if (isCallInitialized) {
      const startTime = Date.now();

      callTimerRef.current = setInterval(() => {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        setCallStats(prev => ({ ...prev, duration }));
      }, 1000);

      return () => {
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
        }
      };
    }
  }, [isCallInitialized]);

  // Initialize call statistics monitoring
  useEffect(() => {
    if (isCallInitialized && peerConnectionRef.current) {
      const getStats = async () => {
        try {
          const stats = await peerConnectionRef.current.getStats();
          let bytesTransferred = 0;
          let bandwidth = 0;
          let resolution = "";
          let packetLoss = 0;
          let framesReceived = 0;
          let framesDropped = 0;
          let jitter = 0;

          stats.forEach(stat => {
            // Calculate bandwidth and bytes transferred
            if (stat.type === "outbound-rtp" && stat.bytesSent) {
              bytesTransferred += stat.bytesSent;
              if (
                stat.timestamp &&
                stat.prevTimestamp &&
                stat.bytesSent &&
                stat.prevBytesSent
              ) {
                const timeDiff = stat.timestamp - stat.prevTimestamp;
                if (timeDiff > 0) {
                  const bitsSent = 8 * (stat.bytesSent - stat.prevBytesSent);
                  const kbps = Math.round(bitsSent / timeDiff);
                  bandwidth = kbps;
                }
              }

              // Save current values for next calculation
              stat.prevBytesSent = stat.bytesSent;
              stat.prevTimestamp = stat.timestamp;
            }

            // Get resolution
            if (
              stat.type === "track" &&
              stat.kind === "video" &&
              stat.frameWidth &&
              stat.frameHeight
            ) {
              resolution = `${stat.frameWidth}x${stat.frameHeight}`;
              
              // Check for dropped frames
              if (stat.framesReceived) {
                framesReceived = stat.framesReceived;
              }
              
              if (stat.framesDropped) {
                framesDropped = stat.framesDropped;
              }
            }

            // Get packet loss and jitter
            if (stat.type === "remote-inbound-rtp") {
              if (typeof stat.packetsLost === "number") {
                packetLoss = stat.packetsLost;
              }
              
              if (typeof stat.jitter === "number") {
                jitter = stat.jitter;
              }
            }
          });

          // Determine connection quality with more metrics
          let connectionQuality = "good";
          if (bandwidth < 100 || packetLoss > 10 || jitter > 50) {
            connectionQuality = "poor";
          } else if (bandwidth < 500 || packetLoss > 5 || jitter > 30 || (framesReceived > 0 && framesDropped/framesReceived > 0.1)) {
            connectionQuality = "fair";
          }

          // Check if we're receiving video frames
          if (remoteStream && role === "supervisor") {
            if (framesReceived === 0) {
              // If not receiving frames for 5 seconds, try reconnecting
              if (!noRemoteVideoTimeoutRef.current) {
                noRemoteVideoTimeoutRef.current = setTimeout(() => {
                  logWithContext("No video frames received for 5 seconds, attempting reconnection");
                  toast.warning("Video stream appears to be frozen, attempting to reconnect...");
                  tryReconnect();
                  noRemoteVideoTimeoutRef.current = null;
                }, 5000);
              }
            } else if (noRemoteVideoTimeoutRef.current) {
              // If receiving frames again, clear the timeout
              clearTimeout(noRemoteVideoTimeoutRef.current);
              noRemoteVideoTimeoutRef.current = null;
            }
          }

          setCallStats(prev => ({
            ...prev,
            bytesTransferred,
            bandwidth,
            resolution,
            connectionQuality,
            packetLoss,
            jitter,
            framesDropped,
            framesReceived
          }));

          // Share connection stats with other participant
          if (socket) {
            socket.emit("connection_stats", {
              callId,
              stats: {
                bandwidth,
                resolution,
                packetLoss,
                jitter,
                framesDropped,
                framesReceived
              },
              quality: connectionQuality
            });
          }
        } catch (error) {
          logWithContext("Error getting call stats:", error);
        }
      };

      statsIntervalRef.current = setInterval(getStats, 3000);

      return () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
        }
        
        if (noRemoteVideoTimeoutRef.current) {
          clearTimeout(noRemoteVideoTimeoutRef.current);
          noRemoteVideoTimeoutRef.current = null;
        }
      };
    }
  }, [isCallInitialized, socket, callId, remoteStream]);

  // Setup health check interval (separate from stats) to detect stalled connections
  useEffect(() => {
    if (isCallInitialized && peerConnectionRef.current) {
      const healthCheckInterval = setInterval(() => {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        
        // Check if connection is stalled
        const currentState = pc.iceConnectionState;
        const currentTime = Date.now();
        
        // If connection is connected but no ICE candidates gathered recently (30s),
        // and we have poor quality, try to reconnect
        if (currentState === 'connected' && 
            (currentTime - lastIceGatheringTime.current > 30000) && 
            callStats.connectionQuality === 'poor') {
          logWithContext("Connection health check: Stalled connection detected");
          toast.warning("Connection appears to be stalled. Attempting to improve...");
          
          // Attempt to restart ICE gathering
          if (pc.restartIce) {
            pc.restartIce();
            lastIceGatheringTime.current = currentTime;
          }
        }
        
        // For disconnected or failed state, we already handle in the state change handler
        
      }, 15000); // Check every 15 seconds
      
      return () => clearInterval(healthCheckInterval);
    }
  }, [isCallInitialized, callStats.connectionQuality]);

  // Enumerate available devices
  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const cameras = devices
        .filter(device => device.kind === "videoinput")
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}`
        }));

      const microphones = devices
        .filter(device => device.kind === "audioinput")
        .map(device => ({
          id: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}`
        }));

      setAvailableDevices({
        cameras,
        microphones
      });
    } catch (error) {
      logWithContext("Error enumerating devices:", error);
    }
  }, []);

  // Get available devices on component mount
  useEffect(() => {
    if (navigator.mediaDevices) {
      getAvailableDevices();

      // Listen for device changes
      navigator.mediaDevices.addEventListener(
        "devicechange",
        getAvailableDevices
      );

      return () => {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          getAvailableDevices
        );
      };
    }
  }, [getAvailableDevices]);

  // Handle automatic reconnection at regular intervals
  useEffect(() => {
    if (isCallInitialized) {
      // Set up auto-reconnect timer to periodically refresh connection
      const autoReconnectInterval = setInterval(() => {
        if (peerConnectionRef.current && 
            peerConnectionRef.current.connectionState === 'connected' && 
            !isReconnecting) {
          // Only refresh if connection has been established for over 5 minutes
          if (callStats.duration > 300) {
            logWithContext("Auto-refreshing connection after 5 minutes");
            refreshConnection();
          }
        }
      }, 300000); // Every 5 minutes

      autoReconnectIntervalRef.current = autoReconnectInterval;

      return () => {
        clearInterval(autoReconnectInterval);
        autoReconnectIntervalRef.current = null;
      };
    }
  }, [isCallInitialized, callStats.duration, isReconnecting]);

  // Improved initializeCall function with better error handling
  const initializeCall = async (isRefresh = false) => {
    try {
      logWithContext("Initializing call...");
      
      // Clear any previous connection timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      
      // Create new peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      // Reset ICE candidates array
      iceCandidatesRef.current = [];
      
      peerConnectionRef.current = new RTCPeerConnection(configuration);
      setConnectionState("new");
      
      // Set up media stream first
      const stream = await setupMediaStream();

      if (!stream) {
        throw new Error("Failed to get media stream");
      }

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      // Set up event handlers
      setupPeerConnectionHandlers();

      // Set a connection timeout - if connection not established in 30 seconds, try reconnecting
      connectionTimeoutRef.current = setTimeout(() => {
        if (peerConnectionRef.current && 
            (peerConnectionRef.current.connectionState !== 'connected' && 
             peerConnectionRef.current.connectionState !== 'completed')) {
          logWithContext("Connection timeout - not connected after 30 seconds");
          toast.error("Failed to establish connection. Attempting to reconnect...");
          tryReconnect();
        }
        connectionTimeoutRef.current = null;
      }, 30000);

      if (isRefresh) {
        socket.emit("rejoin_call", { callId, role, claimNumber });
      } else {
        socket.emit("join_call", { callId, role, claimNumber });
      }

      setIsCallInitialized(true);
      
      return true;
    } catch (error) {
      logWithContext("Error initializing call:", error);
      
      // Handle specific errors
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        toast.error("Camera or microphone permission denied. Please check your browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        toast.error("Camera or microphone not found. Please check your device connections.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        toast.error("Could not access camera or microphone. They may be in use by another application.");
      } else {
        toast.error(`Failed to start call: ${error.message}`);
      }
      
      peerConnectionRef.current = null;
      throw error;
    }
  };

  // Setup media stream with enhanced error handling
  const setupMediaStream = async () => {
    try {
      logWithContext(
        "Setting up media stream, camera:",
        isBackCamera ? "back" : "front"
      );

      // Using constraints from ref to maintain state between function calls
      const constraints = mediaConstraintsRef.current;

      // First try with ideal settings
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        logWithContext(
          "Got media stream:",
          stream.getTracks().map(t => `${t.kind} (${t.label})`)
        );

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;

          // Explicitly handle mirroring for investigator
          if (role === "investigator") {
            // Mirror only for front camera
            localVideoRef.current.classList.toggle("mirror-video", !isBackCamera);
          }
        }

        setLocalStream(stream);
        mediaStreamRef.current = stream;
        setIsCameraReady(true);
        setHasMediaPermissions(true);

        return stream;
      } catch (error) {
        // If failed with ideal settings, try with more basic settings
        logWithContext("Failed with ideal settings, trying basic settings:", error);
        
        const basicConstraints = {
          video: {
            facingMode: isBackCamera ? "environment" : "user",
          },
          audio: true
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
        logWithContext("Got media stream with basic settings:", stream.getTracks().length);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          if (role === "investigator") {
            localVideoRef.current.classList.toggle("mirror-video", !isBackCamera);
          }
        }

        setLocalStream(stream);
        mediaStreamRef.current = stream;
        setIsCameraReady(true);
        setLocalStream(stream);
        mediaStreamRef.current = stream;
        setIsCameraReady(true);
        setHasMediaPermissions(true);
        
        toast.info("Using basic camera settings due to device limitations");
        return stream;
      }
    } catch (error) {
      logWithContext("Error setting up media stream:", error);
      setHasMediaPermissions(false);
      
      // Enhanced error messaging for better user experience
      if (error.name === "NotAllowedError") {
        toast.error("Camera/microphone access denied. Please check your permissions.");
      } else if (error.name === "NotFoundError") {
        toast.error("No camera or microphone found. Please check your hardware.");
      } else if (error.name === "NotReadableError") {
        toast.error("Camera or microphone is already in use by another application.");
      } else if (error.name === "OverconstrainedError") {
        toast.error("Camera doesn't support requested resolution. Using lower quality.");
        // Could try again with lower constraints here
      } else {
        toast.error("Failed to access camera/microphone. Please check permissions.");
      }
      
      throw error;
    }
  };

  // Enhanced peer connection handlers with better connection monitoring
  const setupPeerConnectionHandlers = () => {
    if (!peerConnectionRef.current) return;

    peerConnectionRef.current.ontrack = (event) => {
      logWithContext("Received remote track:", event.track.kind);
      
      // Add event listeners to monitor track status
      event.track.onmute = () => {
        logWithContext(`Remote ${event.track.kind} track muted`);
        if (event.track.kind === "video") {
          toast.info("Remote video paused or muted");
        }
      };
      
      event.track.onunmute = () => {
        logWithContext(`Remote ${event.track.kind} track unmuted`);
        if (event.track.kind === "video") {
          toast.info("Remote video resumed");
        }
      };
      
      event.track.onended = () => {
        logWithContext(`Remote ${event.track.kind} track ended`);
        if (event.track.kind === "video") {
          toast.warning("Remote video stream ended");
          
          // If track ends unexpectedly, try to recover
          if (isCallInitialized && !isReconnecting) {
            setTimeout(() => {
              if (!remoteStream || !remoteStream.getVideoTracks().length) {
                logWithContext("Video track ended unexpectedly, attempting recovery");
                tryReconnect();
              }
            }, 3000);
          }
        }
      };
      
      // Set stream to video element
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteStream(event.streams[0]);
        
        // Clear any pending no-video timeouts
        if (noRemoteVideoTimeoutRef.current) {
          clearTimeout(noRemoteVideoTimeoutRef.current);
          noRemoteVideoTimeoutRef.current = null;
        }
        
        // Check if we actually get frames
        setTimeout(() => {
          if (remoteVideoRef.current && 
              (!remoteVideoRef.current.videoWidth || !remoteVideoRef.current.videoHeight)) {
            logWithContext("Remote video received but no frames showing");
            toast.warning("Connected but video may not be working. Will try to recover...");
            
            // Schedule a connection refresh
            setTimeout(() => {
              if (isCallInitialized && peerConnectionRef.current) {
                refreshConnection();
              }
            }, 5000);
          } else {
            logWithContext(`Remote video showing: ${remoteVideoRef.current?.videoWidth}x${remoteVideoRef.current?.videoHeight}`);
          }
        }, 3000);
      }
    };

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        logWithContext("Generated ICE candidate");
        lastIceGatheringTime.current = Date.now();
        
        // Store candidate locally
        iceCandidatesRef.current.push(event.candidate);
        
        // Send to peer
        socket.emit("ice_candidate", { callId, candidate: event.candidate });
      }
    };
    
    peerConnectionRef.current.onicecandidateerror = (event) => {
      logWithContext("ICE candidate error:", {
        errorCode: event.errorCode,
        errorText: event.errorText,
        hostCandidate: event.hostCandidate,
        url: event.url
      });
      
      // If we get TURN errors, switch to relay-only policy
      if (event.errorCode === 701) {
        logWithContext("TURN server error, will switch to relay-only on next connection");
      }
    };
    
    peerConnectionRef.current.oniceconnectionstatechange = () => {
      const state = peerConnectionRef.current.iceConnectionState;
      logWithContext("ICE connection state:", state);
      
      // Update connection state for UI display
      setConnectionState(state);
      
      // Handle dropped connections more aggressively
      switch (state) {
        case "checking":
          // Show user that we're establishing connection
          if (!isReconnecting) {
            toast.info("Establishing connection...");
          }
          break;
        
        case "connected":
        case "completed":
          // Clear any scheduled reconnection attempts
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          
          if (isReconnecting) {
            toast.success("Connection restored successfully");
            setIsReconnecting(false);
          } else {
            toast.success("Connected successfully");
          }
          break;
        
        case "disconnected":
          // Temporary interruption, wait a bit before trying to reconnect
          toast.warning("Connection interrupted. Attempting to restore...");
          
          // Try to restart ICE gathering
          if (peerConnectionRef.current.restartIce) {
            peerConnectionRef.current.restartIce();
            logWithContext("Restarting ICE gathering");
          }
          
          // If still disconnected after 5 seconds, try more aggressive reconnection
          setTimeout(() => {
            if (peerConnectionRef.current && 
                peerConnectionRef.current.iceConnectionState === "disconnected") {
              logWithContext("Still disconnected after timeout, attempting full reconnection");
              tryReconnect();
            }
          }, 5000);
          break;
        
        case "failed":
          toast.error("Connection failed. Attempting to reconnect...");
          tryReconnect();
          break;
          
        case "closed":
          logWithContext("ICE connection closed");
          break;
      }
    };

    peerConnectionRef.current.onconnectionstatechange = () => {
      const state = peerConnectionRef.current.connectionState;
      logWithContext("Connection state:", state);
      setConnectionState(state);
      
      handleConnectionStateChange(state);
    };
    
    // Monitor for signaling state changes
    peerConnectionRef.current.onsignalingstatechange = () => {
      logWithContext("Signaling state:", peerConnectionRef.current.signalingState);
      
      // If we get stuck in have-local-offer, try to recover
      if (peerConnectionRef.current.signalingState === "have-local-offer") {
        // Set a timeout to check if we're still in this state
        setTimeout(() => {
          if (peerConnectionRef.current && 
              peerConnectionRef.current.signalingState === "have-local-offer") {
            logWithContext("Still in have-local-offer state after timeout");
            
            // If we're not getting answers to our offers, try to reconnect
            if (!isReconnecting) {
              toast.warning("Connection issues detected. Attempting to recover...");
              tryReconnect();
            }
          }
        }, 10000);
      }
    };
    
    // Negotiate when datachannels are added (if you use them)
    peerConnectionRef.current.ondatachannel = (event) => {
      logWithContext("Data channel received", event.channel.label);
    };
  };

  // Initial call setup effect
  useEffect(() => {
    if (!socket) {
      toast.error("No connection to server");
      return;
    }

    const startCall = async () => {
      try {
        await initializeCall();
        logWithContext("Call initialized successfully");
      } catch (error) {
        logWithContext("Failed to start call:", error);
        toast.error("Failed to start call. Please try again.");
        onEndCall();
      }
    };

    startCall();

    // Cleanup function
    return () => {
      logWithContext("Cleaning up call...");
      cleanupCall();
    };
  }, [socket, callId]);

  // Comprehensive cleanup function
  const cleanupCall = () => {
    logWithContext("Running cleanup...");
    
    // Clear all intervals and timeouts
    [
      callTimerRef.current,
      statsIntervalRef.current,
      noRemoteVideoTimeoutRef.current,
      connectionTimeoutRef.current,
      autoReconnectIntervalRef.current,
      pingIntervalRef.current
    ].forEach(timer => {
      if (timer) {
        clearInterval(timer);
        clearTimeout(timer);
      }
    });

    // Stop recording if active
    if (isRecording && recordingStateRef.current) {
      recordingStateRef.current
        .stopRecording()
        .catch(err =>
          logWithContext("Error stopping recording during cleanup:", err)
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
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onsignalingstatechange = null;
      peerConnectionRef.current.ondatachannel = null;
      peerConnectionRef.current.onicecandidateerror = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Reset refs
    callTimerRef.current = null;
    statsIntervalRef.current = null;
    noRemoteVideoTimeoutRef.current = null;
    connectionTimeoutRef.current = null;
    autoReconnectIntervalRef.current = null;
    pingIntervalRef.current = null;
    mediaStreamRef.current = null;
    recordingStateRef.current = null;
    reconnectAttemptRef.current = 0;
    iceCandidatesRef.current = [];

    // Reset state
    setIsCameraReady(false);
    setIsCallInitialized(false);
    setHasMediaPermissions(false);
    setIsRecording(false);
    setIsReconnecting(false);
    setRemoteCameraActive(true);
    setConnectionState("new");
    setUploadStatus({
      uploading: false,
      progress: 0,
      type: null,
      fileName: null
    });

    // Clear session storage
    sessionStorage.removeItem("callState");
  };

  const handleEndCall = () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording().catch(err =>
        logWithContext("Error stopping recording before ending call:", err)
      );
    }

    socket.emit("end_call", { callId });
    cleanupCall();
    onEndCall();
  };
  
  // Function to handle connection refresh without full reconnection
  const refreshConnection = async () => {
    if (!peerConnectionRef.current || isReconnecting) return;
    
    logWithContext("Refreshing connection");
    
    try {
      // Create a new offer to refresh the connection
      const offer = await peerConnectionRef.current.createOffer({
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      socket.emit("video_offer", { callId, offer });
      
      // Restart ICE gathering
      if (peerConnectionRef.current.restartIce) {
        peerConnectionRef.current.restartIce();
      }
      
      logWithContext("Connection refresh initiated");
    } catch (error) {
      logWithContext("Error refreshing connection:", error);
      // If refresh fails, try full reconnection
      tryReconnect();
    }
  };
  
  // Function to attempt a full reconnection
  const tryReconnect = async () => {
    if (isReconnecting) {
      logWithContext("Already reconnecting, skipping duplicate attempt");
      return;
    }
    
    setIsReconnecting(true);
    reconnectAttemptRef.current++;
    
    // Calculate backoff delay - exponential with max of 30 seconds
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptRef.current - 1), 30000);
    const attemptNum = reconnectAttemptRef.current;
    
    logWithContext(`Scheduling reconnection attempt #${attemptNum} in ${delay}ms`);
    toast.info(`Connection issues detected. Reconnecting in ${Math.ceil(delay/1000)} seconds...`);
    
    // Wait for delay before attempting reconnection
    setTimeout(async () => {
      // Check if component is still mounted
      if (!peerConnectionRef.current) {
        logWithContext("Component unmounted before reconnection attempt");
        setIsReconnecting(false);
        return;
      }
      
      try {
        logWithContext(`Starting reconnection attempt #${attemptNum}`);
        
        // Close existing connection
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        
        // Initialize a new connection
        await initializeCall(true);
        
        if (reconnectAttemptRef.current >= 3) {
          // After multiple attempts, suggest refreshing the page
          toast.warning("If connection problems persist, try refreshing the page.");
        }
      } catch (error) {
        logWithContext(`Reconnection attempt #${attemptNum} failed:`, error);
        toast.error("Reconnection failed. Will try again shortly...");
        
        // If we've tried too many times, suggest ending the call
        if (reconnectAttemptRef.current >= 5) {
          toast.error("Unable to establish a stable connection. Consider ending the call and trying again.");
        } else {
          // Schedule another attempt
          setIsReconnecting(false);
          tryReconnect();
        }
      }
    }, delay);
  };

  // Handle WebRTC reconnection when page visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        logWithContext("Page became visible, checking connection");
        
        // If we were in an active call but lost connection, try to reconnect
        if (isCallInitialized && (!peerConnectionRef.current || 
            (peerConnectionRef.current.connectionState !== 'connected' && 
             peerConnectionRef.current.connectionState !== 'completed'))) {
          logWithContext("Connection appears broken after visibility change");
          toast.info("Checking connection status after returning to app");
          
          // Wait a moment before reconnecting
          setTimeout(() => {
            if (isCallInitialized && (!peerConnectionRef.current || 
                (peerConnectionRef.current.connectionState !== 'connected' && 
                 peerConnectionRef.current.connectionState !== 'completed'))) {
              tryReconnect();
            }
          }, 2000);
        } else if (peerConnectionRef.current) {
          // If connection exists but may be stale, refresh it
          refreshConnection();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isCallInitialized]);

  // Torch toggle function
  const toggleTorch = async () => {
    try {
      if (mediaStreamRef.current) {
        const track = mediaStreamRef.current.getVideoTracks()[0];
        if (track && track.getCapabilities && track.getCapabilities().torch) {
          await track.applyConstraints({
            advanced: [{ torch: !isTorchOn }]
          });
          setIsTorchOn(!isTorchOn);
          
          if (!isTorchOn) {
            toast.info("Flashlight turned on");
          } else {
            toast.info("Flashlight turned off");
          }
        } else {
          toast.warning("Torch not available on this device");
        }
      }
    } catch (error) {
      logWithContext("Error toggling torch:", error);
      toast.error("Failed to toggle torch");
    }
  };

  // Mute toggle function
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      socket.emit("participant_muted", { callId, isMuted: !isMuted });
      
      toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
    }
  };

  // Video toggle function
  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
      socket.emit("participant_video_state", {
        callId,
        isVideoOff: !isVideoOff
      });
      
      toast.info(isVideoOff ? "Camera turned on" : "Camera turned off");
    }
  };

  // Enhanced camera toggle with improved track replacement
  const toggleCamera = async () => {
    try {
      if (!peerConnectionRef.current) {
        logWithContext("No peer connection available");
        return;
      }

      const newIsBackCamera = !isBackCamera;
      logWithContext("Switching to camera:", newIsBackCamera ? "back" : "front");
      toast.info(`Switching to ${newIsBackCamera ? 'back' : 'front'} camera...`);

      // Stop old tracks first
      if (localStream) {
        localStream.getVideoTracks().forEach(track => track.stop());
      }

      // Get new stream with switched camera
      const videoConstraints = {
        facingMode: newIsBackCamera ? "environment" : "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      // Update constraints reference
      mediaConstraintsRef.current = {
        ...mediaConstraintsRef.current,
        video: videoConstraints
      };

      try {
        // Try with ideal constraints first
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
  
        // Apply mute state to the new audio track
        if (isMuted && audioTrack) {
          audioTrack.enabled = false;
        }
  
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
          localVideoRef.current.classList.toggle(
            "mirror-video",
            !newIsBackCamera
          );
        }
  
        // Update state
        setLocalStream(newStream);
        mediaStreamRef.current = newStream;
        setIsBackCamera(newIsBackCamera);
        localStorage.setItem(
          "preferredCamera",
          newIsBackCamera ? "back" : "front"
        );
  
        // Replace tracks in peer connection
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(
          sender => sender.track && sender.track.kind === "video"
        );
  
        const audioSender = senders.find(
          sender => sender.track && sender.track.kind === "audio"
        );
  
        // Replace video track
        if (videoSender && newStream.getVideoTracks()[0]) {
          await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
        }
  
        // Replace audio track if needed
        if (audioSender && newStream.getAudioTracks()[0]) {
          await audioSender.replaceTrack(newStream.getAudioTracks()[0]);
        }
  
        // Create and send a new offer to renegotiate the connection
        const offer = await peerConnectionRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit("video_offer", { callId, offer });
  
        logWithContext("Camera switch completed successfully");
        toast.success("Camera switched successfully");
      } catch (error) {
        logWithContext("Error with ideal camera settings, trying basic settings:", error);
        
        // Try with basic constraints
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newIsBackCamera ? "environment" : "user" },
          audio: false
        });
        
        // Rest of the camera switching code (same as above)
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack) {
          newStream.addTrack(audioTrack);
        }
  
        if (isMuted && audioTrack) {
          audioTrack.enabled = false;
        }
  
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
          localVideoRef.current.classList.toggle("mirror-video", !newIsBackCamera);
        }
  
        setLocalStream(newStream);
        mediaStreamRef.current = newStream;
        setIsBackCamera(newIsBackCamera);
        localStorage.setItem("preferredCamera", newIsBackCamera ? "back" : "front");
  
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => sender.track && sender.track.kind === "video");
        const audioSender = senders.find(sender => sender.track && sender.track.kind === "audio");
  
        if (videoSender && newStream.getVideoTracks()[0]) {
          await videoSender.replaceTrack(newStream.getVideoTracks()[0]);
        }
  
        if (audioSender && newStream.getAudioTracks()[0]) {
          await audioSender.replaceTrack(newStream.getAudioTracks()[0]);
        }
  
        const offer = await peerConnectionRef.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit("video_offer", { callId, offer });
  
        logWithContext("Camera switch completed with basic settings");
        toast.success("Camera switched successfully (basic quality)");
      }
    } catch (error) {
      logWithContext("Error switching camera:", error);
      toast.error("Failed to switch camera. Please try again.");
    }
  };

  // Chat message sending function
  const sendMessage = e => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      callId,
      role,
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
      type: "chat" // Add type to distinguish from screenshots
    };

    // Emit message to server
    socket.emit("chat_message", messageData);

    // Add message to local state
    setMessages(prev => [...prev, { ...messageData, isLocal: true }]);
    setNewMessage("");
  };
  // Enhanced connection state change handler
  const handleConnectionStateChange = (state) => {
    if (!peerConnectionRef.current) return;
    
    logWithContext("Connection state changed:", state);

    switch (state) {
      case "new":
        // Connection just created, no special handling needed
        break;
        
      case "connecting":
        toast.info("Establishing connection...");
        break;
        
      case "connected":
        toast.success("Connected to peer");
        reconnectAttemptRef.current = 0;
        setIsReconnecting(false);
        
        // Clear any pending reconnection timeouts
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        break;
        
      case "disconnected":
        toast.warning("Connection interrupted. Attempting to restore...");
        
        // Wait a bit and check if we reconnect automatically
        setTimeout(() => {
          if (peerConnectionRef.current && 
              peerConnectionRef.current.connectionState === "disconnected") {
            // If still disconnected, try to refresh the connection
            refreshConnection();
            
            // If that doesn't help after some time, try full reconnection
            setTimeout(() => {
              if (peerConnectionRef.current && 
                  (peerConnectionRef.current.connectionState === "disconnected" || 
                   peerConnectionRef.current.connectionState === "failed")) {
                tryReconnect();
              }
            }, 10000);
          }
        }, 5000);
        break;
        
      case "failed":
        toast.error("Connection failed. Attempting to reconnect...");
        
        // Try a full reconnection
        if (!isReconnecting) {
          tryReconnect();
        }
        break;
        
      case "closed":
        logWithContext("Connection closed");
        // If closed unexpectedly during an active call, try to reconnect
        if (isCallInitialized && !isReconnecting) {
          toast.error("Connection closed unexpectedly");
          tryReconnect();
        }
        break;
        
      default:
        break;
    }
  };

  // Enhanced screenshot capture with improved AWS upload and error handling
  const takeScreenshot = async () => {
    try {
      let videoToCapture;
      let locationInfo = null;

      if (role === "investigator") {
        // Investigator captures their own video
        videoToCapture = localVideoRef.current;
        if (currentLocation) {
          locationInfo = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: currentLocation.accuracy,
            altitude: currentLocation.altitude,
            heading: currentLocation.heading,
            speed: currentLocation.speed
          };
        }
      } else {
        // Supervisor captures the investigator's video stream
        videoToCapture = remoteVideoRef.current;

        // Use the most recent location data from investigator
        if (messages.some(m => m.type === "location_update")) {
          const lastLocationMsg = [...messages]
            .filter(m => m.type === "location_update")
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

          if (lastLocationMsg && lastLocationMsg.location) {
            locationInfo = lastLocationMsg.location;
          } else {
            // Request updated location if none found
            socket.emit("request_location", { callId });
          }
        } else {
          // Request location if none available
          socket.emit("request_location", { callId });
        }
      }

      if (!videoToCapture || !videoToCapture.srcObject) {
        toast.error("No video stream available to capture");
        return;
      }
      
      // Check if video element has loaded dimensions
      if (videoToCapture.videoWidth === 0 || videoToCapture.videoHeight === 0) {
        toast.error("Video not ready for screenshot. Please try again in a moment");
        return;
      }

      // Show capturing state
      toast.info("Capturing screenshot...");

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = videoToCapture.videoWidth;
      canvas.height = videoToCapture.videoHeight;

      // Try to capture with error handling
      try {
        // Draw the video frame (handle mirroring based on camera and role)
        if (role === "investigator") {
          if (!isBackCamera) {
            // Front camera needs to be un-mirrored for screenshot
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
            context.drawImage(videoToCapture, 0, 0, -canvas.width, canvas.height);
          } else {
            // Back camera - draw normally
            context.drawImage(videoToCapture, 0, 0, canvas.width, canvas.height);
          }
        } else {
          // For supervisor, draw normally
          context.drawImage(videoToCapture, 0, 0, canvas.width, canvas.height);
        }
      } catch (drawError) {
        logWithContext("Error drawing video to canvas:", drawError);
        toast.error("Failed to capture screenshot. Video stream may be unavailable");
        return;
      }

      // Add location and timestamp information if available
      if (locationInfo) {
        // Format the location text
        const locationText = `Lat: ${locationInfo.latitude.toFixed(
          6
        )}, Long: ${locationInfo.longitude.toFixed(6)}`;

        // Add semi-transparent background for text
        context.fillStyle = "rgba(0, 0, 0, 0.5)";
        context.fillRect(10, canvas.height - 70, canvas.width - 20, 60);

        // Add location text
        context.fillStyle = "white";
        context.font = "16px Arial";
        context.fillText(locationText, 20, canvas.height - 45);
        context.fillText(
          `Accuracy: ${locationInfo.accuracy.toFixed(1)}m`,
          20,
          canvas.height - 20
        );

        // Add timestamp
        const timestamp = new Date().toLocaleString();
        context.fillText(timestamp, 20, canvas.height - 70);
      } else {
        // Always add timestamp even if no location
        const timestamp = new Date().toLocaleString();
        context.fillStyle = "rgba(0, 0, 0, 0.5)";
        context.fillRect(10, canvas.height - 30, canvas.width - 20, 30);
        context.fillStyle = "white";
        context.font = "16px Arial";
        context.fillText(timestamp, 20, canvas.height - 10);
      }

      const timestamp = new Date().toISOString();
      
      // Use try-catch for toDataURL which can fail if video sources are cross-origin
      let screenshotDataUrl;
      try {
        screenshotDataUrl = canvas.toDataURL("image/jpeg", 0.95); // Higher quality JPEG
      } catch (dataUrlError) {
        logWithContext("Error creating data URL:", dataUrlError);
        toast.error("Failed to process screenshot. Please try again.");
        return;
      }

      // Create screenshot metadata
      const screenshot = {
        id: Date.now(),
        url: screenshotDataUrl,
        timestamp: timestamp,
        location: locationInfo,
        type: "screenshot",
        locationText: locationInfo
          ? `${locationInfo.latitude.toFixed(
              6
            )}, ${locationInfo.longitude.toFixed(6)}`
          : null,
        timestampText: new Date(timestamp).toLocaleString(),
        capturedBy: role
      };

      // Add screenshot to messages
      setMessages(prev => [...prev, { ...screenshot, isLocal: true }]);
      toast.success("Screenshot captured");

      // Save to S3 Storage with improved progress tracking
      if (claimNumber) {
        setUploadStatus({
          uploading: true,
          progress: 10,
          type: "screenshot",
          fileName: `screenshot-${new Date()
            .toISOString()
            .replace(/[:.-]/g, "_")}.jpg`
        });

        try {
          const blobUrl = await uploadScreenshot(
            claimNumber,
            callId,
            screenshotDataUrl,
            {
              timestamp: timestamp,
              capturedBy: role,
              location: locationInfo,
              resolution: `${canvas.width}x${canvas.height}`
            },
            progress => {
              setUploadStatus(prev => ({
                ...prev,
                progress: progress
              }));
            }
          );

          // Update the screenshot with the S3 URL
          setMessages(prev =>
            prev.map(msg =>
              msg.id === screenshot.id ? { ...msg, s3Url: blobUrl } : msg
            )
          );

          toast.success("Screenshot saved to cloud storage");
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });
        } catch (error) {
          logWithContext("Failed to upload screenshot to S3:", error);
          toast.error("Failed to save screenshot to cloud storage");
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });
        }
      }

      // Save screenshot to server and notify other participants
      socket.emit("save_screenshot", {
        callId,
        screenshot: screenshotDataUrl,
        timestamp: timestamp,
        location: locationInfo,
        capturedBy: role,
        claimNumber: claimNumber || null
      });
    } catch (error) {
      logWithContext("Error taking screenshot:", error);
      toast.error("Failed to capture screenshot. Please try again");
      setUploadStatus({
        uploading: false,
        progress: 0,
        type: null,
        fileName: null
      });
    }
  };

  // Toggle recording function with retries
  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startCallRecording();
    }
  };

  // Improved startCallRecording function with better error handling and retries
  const startCallRecording = async () => {
    // More detailed claimNumber check
    if (!claimNumber || claimNumber.trim() === "") {
      logWithContext("Cannot start recording: No claim number provided");
      toast.error("Cannot start recording: No claim number provided");
      return;
    }

    try {
      // For supervisor, send command to investigator to start recording
      if (role === "supervisor") {
        toast.info("Starting recording on investigator device...");
        socket.emit("recording_status", {
          callId,
          isRecording: true,
          startedBy: role,
          timestamp: new Date().toISOString()
        });

        // Local UI updates for supervisor
        setIsRecording(true);
      } else if (role === "investigator") {
        toast.info("Starting recording...");
        setUploadStatus({
          uploading: true,
          progress: 0,
          type: "recording",
          fileName: `call-${callId}-${new Date()
            .toISOString()
            .slice(0, 10)}.webm`
        });

        // Improved stream checking with more detailed error info
        const stream = localVideoRef.current?.srcObject;
        if (!stream) {
          const errorMsg = "No video stream available to record";
          logWithContext(errorMsg);
          toast.error(errorMsg);
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });

          // Notify others of specific failure reason
          socket.emit("recording_error", {
            callId,
            error: { message: errorMsg }
          });
          return;
        }

        // Check for video tracks
        if (stream.getVideoTracks().length === 0) {
          const errorMsg = "No video track in stream";
          logWithContext(errorMsg);
          toast.error(errorMsg);
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });
          socket.emit("recording_error", {
            callId,
            error: { message: errorMsg }
          });
          return;
        }

        // Start recording with more detailed error handling
        try {
          logWithContext(
            "Starting recording with stream:",
            stream.id,
            "tracks:",
            stream
              .getTracks()
              .map(t => t.kind)
              .join(",")
          );
          
          // Add explicit retry logic for recording
          const MAX_RETRIES = 2;
          let recordingAttempt = 0;
          let success = false;
          
          while (recordingAttempt < MAX_RETRIES && !success) {
            try {
              recordingAttempt++;
              recordingStateRef.current = await startRecording(
                claimNumber,
                callId,
                stream,
                {
                  onProgressUpdate: progress => {
                    setUploadStatus(prev => ({
                      ...prev,
                      progress
                    }));
                  }
                }
              );
              success = true;
            } catch (recordError) {
              logWithContext(`Recording attempt ${recordingAttempt} failed:`, recordError);
              
              if (recordingAttempt >= MAX_RETRIES) {
                throw recordError; // Re-throw if all retries failed
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
              toast.info(`Retrying recording (attempt ${recordingAttempt + 1}/${MAX_RETRIES})...`);
            }
          }

          setIsRecording(true);

          // Notify others (if investigator initiates recording)
          socket.emit("recording_status", {
            callId,
            isRecording: true,
            startedBy: role,
            timestamp: new Date().toISOString()
          });
        } catch (recordingError) {
          // Handle specific recording errors
          const errorMsg = `Recording failed: ${recordingError.message ||
            "Unknown error"}`;
          logWithContext(errorMsg, recordingError);
          toast.error(errorMsg);
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });

          socket.emit("recording_error", {
            callId,
            error: { message: errorMsg }
          });
        }
      }
    } catch (error) {
      // Generic error catch with detailed error reporting
      const errorMsg = `Failed to start recording: ${error.message ||
        "Unknown error"}`;
      logWithContext(errorMsg, error);
      toast.error(errorMsg);
      setIsRecording(false);
      setUploadStatus({
        uploading: false,
        progress: 0,
        type: null,
        fileName: null
      });

      socket.emit("recording_error", {
        callId,
        error: { message: errorMsg }
      });
    }
  };

  // Improved stopRecording function with better error handling and upload monitoring
  const stopRecording = async () => {
    if (role === "supervisor") {
      // Supervisor just sends the stop command
      toast.info("Stopping recording...");
      socket.emit("recording_status", {
        callId,
        isRecording: false,
        stoppedBy: role,
        timestamp: new Date().toISOString()
      });

      // Update UI immediately (the investigator will handle actual stopping)
      setIsRecording(false);
    } else if (role === "investigator") {
      // Investigator does the actual recording stop and upload
      if (!recordingStateRef.current) {
        logWithContext("No active recording to stop");
        setIsRecording(false);
        return;
      }

      try {
        toast.info("Stopping recording and preparing upload...");
        setUploadStatus(prev => ({
          ...prev,
          uploading: true,
          progress: 50
        }));

        // Set an upload timeout to detect stalled uploads
        const uploadTimeout = setTimeout(() => {
          if (setUploadStatus.uploading) {
            logWithContext("Upload appears to be stalled");
            toast.warning("Upload is taking longer than expected. Please wait...");
          }
        }, 30000);

        // Stop recording and get the blob URL
        const blobUrl = await recordingStateRef.current.stopRecording();
        
        // Clear upload timeout
        clearTimeout(uploadTimeout);

        if (blobUrl) {
          setRecordingUrl(blobUrl);
          toast.success("Recording saved to cloud storage");

          // Notify everyone the recording is available
          socket.emit("recording_completed", {
            callId,
            recordingUrl: blobUrl,
            recordedBy: role,
            timestamp: new Date().toISOString()
          });
        } else {
          logWithContext("Recording stopped but no blob URL was returned");
          toast.warning("Recording completed but may not have been saved properly");
        }

        // Reset recording state
        recordingStateRef.current = null;
        setIsRecording(false);
        setUploadStatus({
          uploading: false,
          progress: 100,
          type: null,
          fileName: null
        });

        // If investigator initiated the stop, notify others
        socket.emit("recording_status", {
          callId,
          isRecording: false,
          stoppedBy: role,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorMsg = `Error stopping recording: ${error.message ||
          "Unknown error"}`;
        logWithContext(errorMsg, error);
        toast.error("Failed to save recording");
        setIsRecording(false);
        setUploadStatus({
          uploading: false,
          progress: 0,
          type: null,
          fileName: null
        });

        // Notify others of failure
        socket.emit("recording_error", {
          callId,
          error: { message: errorMsg }
        });
      }
    }
  };

  // WebRTC handler with improved signaling
  useEffect(() => {
    if (!socket || !isCallInitialized) return;

    const handleVideoOffer = async ({ offer }) => {
      try {
        logWithContext("Received video offer");
        if (!peerConnectionRef.current) {
          logWithContext("Creating new peer connection for offer");
          peerConnectionRef.current = new RTCPeerConnection(configuration);
          setupPeerConnectionHandlers();
        }

        // Handle case where we might get a new offer while we already have one
        if (peerConnectionRef.current.signalingState === "have-local-offer") {
          logWithContext("Received offer while in have-local-offer state, rolling back");
          try {
            await peerConnectionRef.current.setLocalDescription({type: "rollback"});
          } catch (rollbackError) {
            logWithContext("Error during rollback:", rollbackError);
            // If rollback fails, try to create a new connection
            peerConnectionRef.current.close();
            peerConnectionRef.current = new RTCPeerConnection(configuration);
            setupPeerConnectionHandlers();
          }
        }

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        // Set up local stream if not already done
        if (!localStream) {
          const stream = await setupMediaStream();
          stream.getTracks().forEach(track => {
            peerConnectionRef.current.addTrack(track, stream);
          });
        } else {
          // Make sure tracks are added to the connection
          localStream.getTracks().forEach(track => {
            // Check if track is already added
            const senders = peerConnectionRef.current.getSenders();
            const trackAlreadyAdded = senders.some(sender => 
              sender.track && sender.track.id === track.id);
              
            if (!trackAlreadyAdded) {
              peerConnectionRef.current.addTrack(track, localStream);
            }
          });
        }

        // Create answer with timeout protection
        try {
          const answerPromise = peerConnectionRef.current.createAnswer();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Answer creation timeout")), 5000)
          );
          
          const answer = await Promise.race([answerPromise, timeoutPromise]);
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit("video_answer", { callId, answer });
          logWithContext("Answer sent successfully");
        } catch (answerError) {
          logWithContext("Error creating answer:", answerError);
          
          // Try again with a minimal answer if timeout occurred
          if (answerError.message === "Answer creation timeout") {
            try {
              const basicAnswer = await peerConnectionRef.current.createAnswer({iceRestart: true});
              await peerConnectionRef.current.setLocalDescription(basicAnswer);
              socket.emit("video_answer", { callId, answer: basicAnswer });
              logWithContext("Basic answer sent after timeout");
            } catch (basicAnswerError) {
              logWithContext("Error creating basic answer:", basicAnswerError);
              toast.error("Failed to respond to connection offer");
              tryReconnect();
            }
          } else {
            toast.error("Failed to process incoming video offer");
            tryReconnect();
          }
        }
      } catch (error) {
        logWithContext("Error handling video offer:", error);
        toast.error("Failed to process incoming video");
        tryReconnect();
      }
    };

    const handleVideoAnswer = async ({ answer }) => {
      try {
        logWithContext("Received video answer");
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          logWithContext("Remote description set successfully");
        }
      } catch (error) {
        logWithContext("Error handling video answer:", error);
        toast.error("Failed to establish video connection");
        
        // If this consistently fails, try reconnecting
        setTimeout(() => {
          if (peerConnectionRef.current && 
              peerConnectionRef.current.connectionState !== "connected") {
            tryReconnect();
          }
        }, 5000);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        logWithContext("Received ICE candidate");
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } else {
          // Queue candidates if we're not ready yet
          logWithContext("Queuing ice candidate for later");
          iceCandidatesRef.current.push(candidate);
        }
      } catch (error) {
        logWithContext("Error handling ICE candidate:", error);
      }
    };

    // Apply any queued ICE candidates when remote description is set
    const applyQueuedCandidates = () => {
      if (peerConnectionRef.current && iceCandidatesRef.current.length > 0) {
        logWithContext(`Applying ${iceCandidatesRef.current.length} queued ICE candidates`);
        
        iceCandidatesRef.current.forEach(async (candidate) => {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } catch (error) {
            logWithContext("Error applying queued ICE candidate:", error);
          }
        });
        
        // Clear the queue
        iceCandidatesRef.current = [];
      }
    };

    // Set up signaling handlers
    socket.on("video_offer", handleVideoOffer);
    socket.on("video_answer", handleVideoAnswer);
    socket.on("ice_candidate", handleIceCandidate);
    
    // Monitor signaling state changes to apply ICE candidates at the right time
    if (peerConnectionRef.current) {
      peerConnectionRef.current.addEventListener('signalingstatechange', () => {
        if (peerConnectionRef.current.signalingState === "stable") {
          applyQueuedCandidates();
        }
      });
    }

    // Create and send offer if investigator
    const createOffer = async () => {
      if (role === "investigator" && peerConnectionRef.current) {
        try {
          logWithContext("Creating offer as investigator");
          const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit("video_offer", { callId, offer });
        } catch (error) {
          logWithContext("Error creating offer:", error);
          toast.error("Failed to start video call");
          
          // Try creating a simpler offer
          setTimeout(async () => {
            try {
              if (peerConnectionRef.current) {
                const simpleOffer = await peerConnectionRef.current.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                  voiceActivityDetection: false
                });
                await peerConnectionRef.current.setLocalDescription(simpleOffer);
                socket.emit("video_offer", { callId, offer: simpleOffer });
                logWithContext("Simple offer sent as fallback");
              }
            } catch (retryError) {
              logWithContext("Error creating simple offer:", retryError);
              tryReconnect();
            }
          }, 2000);
        }
      }
    };

    createOffer();

    return () => {
      socket.off("video_offer", handleVideoOffer);
      socket.off("video_answer", handleVideoAnswer);
      socket.off("ice_candidate", handleIceCandidate);
    };
  }, [socket, isCallInitialized, role, localStream]);

  // Chat and location socket handlers
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = data => {
      logWithContext("Received chat message:", data);
      // Add type if it doesn't exist
      const messageWithType = {
        ...data,
        type: data.type || "chat",
        isLocal: false
      };
      setMessages(prev => [...prev, messageWithType]);

      // Increment unread count if chat is not visible
      if (!showChat || isChatMinimized) {
        setUnreadMessages(prev => prev + 1);
        // Play notification sound if available
        const notificationSound = document.getElementById("notification-sound");
        if (notificationSound) {
          notificationSound
            .play()
            .catch(err =>
              logWithContext("Failed to play notification sound:", err)
            );
        }
      }
    };

    const handleLocationUpdate = data => {
      logWithContext("Received location update:", data);
      if (role === "supervisor") {
        // Store location updates in messages for supervisor
        setMessages(prev => [
          ...prev,
          {
            type: "location_update",
            timestamp: data.timestamp,
            location: data.location,
            isLocal: false
          }
        ]);
      }
    };

    const handleLocationRequest = () => {
      // Investigator responds to location requests
      if (role === "investigator" && currentLocation) {
        socket.emit("location_update", {
          callId,
          location: currentLocation,
          timestamp: new Date().toISOString()
        });
      }
    };

    const handleScreenshotReceived = data => {
      // Handle receiving screenshot from other participant
      if (data.capturedBy !== role) {
        const screenshot = {
          id: Date.now(),
          url: data.screenshot,
          timestamp: data.timestamp,
          location: data.location,
          type: "screenshot",
          locationText: data.location
            ? `${data.location.latitude.toFixed(
                6
              )}, ${data.location.longitude.toFixed(6)}`
            : null,
          timestampText: new Date(data.timestamp).toLocaleString(),
          capturedBy: data.capturedBy,
          isLocal: false,
          s3Url: data.s3Url || null
        };

        setMessages(prev => [...prev, screenshot]);
        toast.info(`${data.capturedBy} captured a screenshot`);
      }
    };

    socket.on("chat_message", handleChatMessage);
    socket.on("location_update", handleLocationUpdate);
    socket.on("request_location", handleLocationRequest);
    socket.on("screenshot_received", handleScreenshotReceived);

    return () => {
      socket.off("chat_message", handleChatMessage);
      socket.off("location_update", handleLocationUpdate);
      socket.off("request_location", handleLocationRequest);
      socket.off("screenshot_received", handleScreenshotReceived);
    };
  }, [socket, role, currentLocation, showChat, isChatMinimized]);

  // Initialize with back camera for investigator on mobile
  useEffect(() => {
    if (role === "investigator" && /Mobi|Android/i.test(navigator.userAgent)) {
      const preferredCamera = localStorage.getItem("preferredCamera");
      const shouldUseBackCamera = preferredCamera
        ? preferredCamera === "back"
        : true;
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

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Auto-scroll chat when new messages arrive
  useEffect(() => {
    if (chatMessagesRef.current && !isChatMinimized) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, isChatMinimized]);

  // Function to handle screenshot click - show in modal instead of new tab
  const handleScreenshotClick = screenshot => {
    setSelectedScreenshot(screenshot);
  };

  // Function to close screenshot modal
  const closeScreenshotModal = () => {
    setSelectedScreenshot(null);
  };

  // Format call duration for display
  const formatDuration = seconds => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes
        .toString()
        .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Format bytes for display
  const formatBytes = bytes => {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  return (
    <div className={`video-call-container ${role}`}>
      {/* Notification sound (hidden) */}
      <audio
        id="notification-sound"
        preload="auto"
        src="/assets/sounds/notification.mp3"
      />

      {role === "investigator" ? (
        <div className="video-layout-investigator">
          <div className="video-fullscreen">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`video-fullscreen-stream ${
                !isBackCamera ? "mirror-video" : ""
              }`}
            />
            
            {/* Prominent Camera Toggle Button */}
            <button 
              className="camera-toggle-button"
              onClick={toggleCamera}
              disabled={!isCameraReady}
              title={`Switch to ${isBackCamera ? "Front" : "Back"} Camera`}
            >
              <FaSyncAlt />
              <span>{isBackCamera ? "Front" : "Back"}</span>
            </button>
            
            {/* Connection status indicator */}
            <div className={`connection-status-indicator ${connectionState}`}>
              <span>{connectionState === "connected" ? "Connected" : connectionState}</span>
              {isReconnecting && <span className="reconnecting-text">Reconnecting...</span>}
            </div>
          </div>

          <div className="pip-container">
            <div className="pip-video">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="pip-stream"
              />
              <div className={`pip-label ${!remoteCameraActive ? 'camera-off' : ''}`}>
                {remoteCameraActive ? 'Supervisor' : 'Supervisor (Camera Off)'}
              </div>
            </div>
          </div>

          {/* Call stats overlay */}
          <div className="call-stats-overlay">
            <div className="call-duration">
              {formatDuration(callStats.duration)}
            </div>
            <div
              className={`connection-quality ${callStats.connectionQuality}`}
            >
              {callStats.connectionQuality}
            </div>
          </div>

          {uploadStatus.uploading && (
            <div className="upload-progress">
              <div className="upload-progress-info">
                <span>
                  {uploadStatus.type === "screenshot"
                    ? "Saving screenshot..."
                    : "Uploading recording..."}
                </span>
                <span>{uploadStatus.fileName}</span>
              </div>
              <div className="progress-container">
                <div
                  className="progress-bar"
                  style={{ width: `${uploadStatus.progress}%` }}
                ></div>
                <span className="progress-text">{uploadStatus.progress}%</span>
              </div>
            </div>
          )}

          {/* Improved Mobile Controls */}
          <div className="video-controls-mobile">
            {role === "investigator" && (
              <button
                onClick={toggleTorch}
                disabled={!isCameraReady}
                className="control-button torch-button"
                title="Toggle Flashlight"
              >
                <FaLightbulb className={isTorchOn ? "torch-on" : ""} />
                <span className="button-label">Light</span>
              </button>
            )}
            <button 
              onClick={toggleMute} 
              className="control-button"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
              <span className="button-label">{isMuted ? "Unmute" : "Mute"}</span>
            </button>
            <button 
              onClick={toggleVideo} 
              className="control-button"
              title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
            >
              {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
              <span className="button-label">{isVideoOff ? "Show Video" : "Hide Video"}</span>
            </button>
            
            {/* Chat Button */}
            <button
              onClick={toggleChat}
              className={`control-button ${unreadMessages > 0 ? "has-notification" : ""}`}
              title="Chat"
            >
              {unreadMessages > 0 ? (
                <>
                  <TiMessages />
                  <span className="notification-badge">{unreadMessages}</span>
                </>
              ) : (
                <FaComment />
              )}
              <span className="button-label">Chat</span>
            </button>
            
            {/* Recording Button with instructional text */}
            <button
              onClick={toggleRecording}
              className={`control-button ${isRecording ? "recording" : ""}`}
              title={
                isRecording
                  ? "Stop Recording"
                  : "Stream has started. Click here to record."
              }
            >
              {isRecording ? <FaVideoSlash /> : <FaVideo />}
              <span className="button-label">
                {isRecording ? "Stop Recording" : "Record"}
              </span>
            </button>
          </div>
        </div>
      ) : (
        // Supervisor layout
        <div className="video-layout-supervisor">
          {/* Large investigator stream */}
          <div className="video-main-feed">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`video-main-stream ${!remoteCameraActive ? 'camera-off' : ''}`}
            />
            <div className="video-feed-label">
              {remoteCameraActive ? 'Investigator' : 'Investigator (Camera Off)'}
            </div>
          </div>

          <div className="side-panel">
            {/* Supervisor's preview */}
            <div className="participant-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`participant-stream ${!isBackCamera ? "mirror-video" : ""}`}
              />
              <div className="participant-label">
                Supervisor
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;