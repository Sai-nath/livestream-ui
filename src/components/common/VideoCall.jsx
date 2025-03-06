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
  FaDesktop,
  FaStop,
  FaCog
} from "react-icons/fa";
import { TiMessages } from "react-icons/ti";
import {
  uploadScreenshot,
  uploadRecording,
  startRecording
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
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

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const recordingStateRef = useRef(null);
  const callTimerRef = useRef(null);
  const screenStreamRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
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

  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      {
        urls: "turn:global.turn.twilio.com:3478?transport=udp",
        username: "your_twilio_username", // Replace with actual credentials from env vars
        credential: "your_twilio_credential"
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    sdpSemantics: "unified-plan"
  };

  // Handle incoming socket events
  useEffect(() => {
    if (!socket) return;

    const handleUserDisconnected = ({ userId }) => {
      console.log("User disconnected:", userId);
      toast.warning("Participant disconnected. They may rejoin shortly.");
    };

    const handleCallEnded = () => {
      console.log("Call ended by peer");
      cleanupCall();
      onEndCall();
    };

    const handleParticipantRejoined = ({ role: rejoiningRole }) => {
      console.log("Participant rejoined:", rejoiningRole);
      toast.info(`${rejoiningRole} has rejoined the call`);
    };

    const handleRecordingStatus = async ({
      isRecording: remoteRecording,
      startedBy,
      stoppedBy,
      timestamp
    }) => {
      console.log(
        `Recording status update: ${remoteRecording ? "started" : "stopped"}`
      );

      if (remoteRecording) {
        // Recording started
        if (
          role === "investigator" &&
          startedBy === "supervisor" &&
          !isRecording
        ) {
          try {
            const stream = localVideoRef.current?.srcObject;
            if (!stream) {
              throw new Error("No video stream available to record");
            }

            if (stream.getVideoTracks().length === 0) {
              throw new Error("No video track available to record");
            }

            // Set up MediaRecorder with optimized settings
            const options = {
              mimeType: MediaRecorder.isTypeSupported(
                "video/mp4; codecs='avc1.42E01E, mp4a.40.2'"
              )
                ? "video/mp4; codecs='avc1.42E01E, mp4a.40.2'"
                : MediaRecorder.isTypeSupported(
                    "video/webm; codecs='vp9, opus'"
                  )
                ? "video/webm; codecs='vp9, opus'"
                : MediaRecorder.isTypeSupported("video/mp4")
                ? "video/mp4"
                : MediaRecorder.isTypeSupported("video/webm")
                ? "video/webm"
                : "",
              videoBitsPerSecond: 2500000 // 2.5 Mbps
            };

            const mediaRecorder = new MediaRecorder(stream, options);
            const chunks = [];

            mediaRecorder.ondataavailable = event => {
              if (event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            mediaRecorder.onstop = async () => {
              try {
                const recordedBlob = new Blob(chunks, { type: "video/webm" });
                const timestamp = new Date()
                  .toISOString()
                  .replace(/[:.]/g, "-");
                const fileName = `recordings/claim-${claimNumber}/call-${callId}/${timestamp}.webm`;

                setUploadStatus({
                  uploading: true,
                  progress: 0,
                  type: "recording",
                  fileName
                });

                const url = await uploadToS3(fileName, recordedBlob, {
                  contentType: "video/webm",
                  metadata: {
                    claimNumber,
                    callId,
                    startTime: timestamp,
                    endTime: new Date().toISOString()
                  },
                  progressCallback: progress => {
                    setUploadStatus(prev => ({
                      ...prev,
                      progress
                    }));
                  }
                });

                setRecordingUrl(url);
                socket.emit("recording_completed", {
                  callId,
                  recordingUrl: url,
                  recordedBy: role,
                  timestamp: new Date().toISOString()
                });

                toast.success("Recording saved successfully");
              } catch (error) {
                console.error("Failed to save recording:", error);
                toast.error("Failed to save recording");
                socket.emit("recording_error", {
                  callId,
                  error: { message: error.message }
                });
              } finally {
                setIsRecording(false);
                setUploadStatus({
                  uploading: false,
                  progress: 0,
                  type: null,
                  fileName: null
                });
                recordingStateRef.current = null;
              }
            };

            // Store recording state
            recordingStateRef.current = {
              mediaRecorder,
              chunks,
              startTime: new Date(),
              stopRecording: () => {
                return new Promise(resolve => {
                  mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: "video/webm" });
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                  };
                  mediaRecorder.stop();
                });
              }
            };

            // Start recording
            mediaRecorder.start(1000); // 1 second chunks
            setIsRecording(true);
            toast.info(`Recording started by ${startedBy}`);
          } catch (error) {
            const errorMsg = `Failed to start recording: ${error.message}`;
            console.error(errorMsg);
            toast.error(errorMsg);
            socket.emit("recording_error", {
              callId,
              error: { message: errorMsg }
            });
          }
        } else if (!isRecording) {
          setIsRecording(true);
          toast.info(`Recording started by ${startedBy}`);
        }
      } else {
        // Recording stopped
        if (
          role === "investigator" &&
          recordingStateRef.current?.mediaRecorder
        ) {
          try {
            await recordingStateRef.current.stopRecording();
          } catch (error) {
            console.error("Error stopping recording:", error);
            toast.error("Failed to stop recording");
          }
        }

        setIsRecording(false);
        toast.info(`Recording stopped by ${stoppedBy}`);
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
              console.error("Failed to stop recording after error:", err)
            );
          recordingStateRef.current = null;
        } catch (err) {
          console.error("Error cleaning up recording after error:", err);
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

    socket.on("user_disconnected", handleUserDisconnected);
    socket.on("call_ended", handleCallEnded);
    socket.on("participant_rejoined", handleParticipantRejoined);
    socket.on("recording_status", handleRecordingStatus);
    socket.on("recording_error", handleRecordingError);
    socket.on("recording_available", handleRecordingAvailable);
    socket.on("connection_quality", handleConnectionQuality);

    // Cleanup socket listeners
    return () => {
      socket.off("user_disconnected", handleUserDisconnected);
      socket.off("call_ended", handleCallEnded);
      socket.off("participant_rejoined", handleParticipantRejoined);
      socket.off("recording_status", handleRecordingStatus);
      socket.off("recording_error", handleRecordingError);
      socket.off("recording_available", handleRecordingAvailable);
      socket.off("connection_quality", handleConnectionQuality);
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
          console.error("Geolocation error:", error);
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
            }

            // Get packet loss
            if (
              stat.type === "remote-inbound-rtp" &&
              typeof stat.packetsLost === "number"
            ) {
              packetLoss = stat.packetsLost;
            }
          });

          // Determine connection quality
          let connectionQuality = "good";
          if (bandwidth < 100 || packetLoss > 10) {
            connectionQuality = "poor";
          } else if (bandwidth < 500 || packetLoss > 5) {
            connectionQuality = "fair";
          }

          setCallStats(prev => ({
            ...prev,
            bytesTransferred,
            bandwidth,
            resolution,
            connectionQuality
          }));

          // Share connection stats with other participant
          if (socket) {
            socket.emit("connection_stats", {
              callId,
              stats: {
                bandwidth,
                resolution,
                packetLoss
              },
              quality: connectionQuality
            });
          }
        } catch (error) {
          console.error("Error getting call stats:", error);
        }
      };

      statsIntervalRef.current = setInterval(getStats, 5000);

      return () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
        }
      };
    }
  }, [isCallInitialized, socket, callId]);

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
      console.error("Error enumerating devices:", error);
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

  const initializeCall = async (isRefresh = false) => {
    try {
      console.log("Initializing call...");

      // Create new peer connection
      peerConnectionRef.current = new RTCPeerConnection(configuration);

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

      if (isRefresh) {
        socket.emit("rejoin_call", { callId, role, claimNumber });
      } else {
        socket.emit("join_call", { callId, role, claimNumber });
      }

      setIsCallInitialized(true);

      return true;
    } catch (error) {
      console.error("Error initializing call:", error);
      peerConnectionRef.current = null;
      throw error;
    }
  };

  const setupMediaStream = async () => {
    try {
      console.log(
        "Setting up media stream, camera:",
        isBackCamera ? "back" : "front"
      );

      // Using constraints from ref to maintain state between function calls
      const constraints = mediaConstraintsRef.current;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log(
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
      console.error("Error setting up media stream:", error);
      setHasMediaPermissions(false);
      toast.error(
        "Failed to access camera/microphone. Please check permissions."
      );
      throw error;
    }
  };

  const setupPeerConnectionHandlers = () => {
    if (!peerConnectionRef.current) return;

    peerConnectionRef.current.ontrack = event => {
      console.log("Received remote track:", event.track.kind);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    peerConnectionRef.current.onicecandidate = event => {
      if (event.candidate) {
        socket.emit("ice_candidate", { callId, candidate: event.candidate });
      }
    };

    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log(
        "Connection state:",
        peerConnectionRef.current.connectionState
      );
      handleConnectionStateChange();
    };

    peerConnectionRef.current.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        peerConnectionRef.current.iceConnectionState
      );

      // Handle dropped connections more aggressively
      if (peerConnectionRef.current.iceConnectionState === "failed") {
        console.log("ICE connection failed, attempting recovery...");

        // Try to restart ICE
        if (peerConnectionRef.current.restartIce) {
          peerConnectionRef.current.restartIce();
        } else {
          // Fallback for browsers that don't support restartIce
          handleConnectionStateChange();
        }
      }
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
        console.log("Call initialized successfully");
      } catch (error) {
        console.error("Failed to start call:", error);
        toast.error("Failed to start call. Please try again.");
        onEndCall();
      }
    };

    startCall();

    // Cleanup function
    return () => {
      console.log("Cleaning up call...");
      cleanupCall();
    };
  }, [socket, callId]);

  const cleanupCall = () => {
    console.log("Running cleanup...");

    // Stop recording if active
    if (isRecording && recordingStateRef.current) {
      recordingStateRef.current
        .stopRecording()
        .catch(err =>
          console.error("Error stopping recording during cleanup:", err)
        );
    }

    // Stop screensharing if active
    if (isScreenSharing && screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
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
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear intervals
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    // Reset state
    setIsCameraReady(false);
    setIsCallInitialized(false);
    setHasMediaPermissions(false);
    setIsRecording(false);
    setUploadStatus({
      uploading: false,
      progress: 0,
      type: null,
      fileName: null
    });
    mediaStreamRef.current = null;
    recordingStateRef.current = null;
    reconnectAttemptRef.current = 0;

    // Clear session storage
    sessionStorage.removeItem("callState");
  };

  const handleEndCall = () => {
    // Stop recording if active
    if (isRecording) {
      stopRecording().catch(err =>
        console.error("Error stopping recording before ending call:", err)
      );
    }

    socket.emit("end_call", { callId });
    cleanupCall();
    onEndCall();
  };

  // Handle WebRTC reconnection
  useEffect(() => {
    let reconnectTimeout;

    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === "visible" &&
        !peerConnectionRef.current
      ) {
        console.log("Page became visible, checking connection...");
        try {
          await initializeCall(true);
        } catch (error) {
          console.error("Failed to reconnect on visibility change:", error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const toggleTorch = async () => {
    try {
      if (mediaStreamRef.current) {
        const track = mediaStreamRef.current.getVideoTracks()[0];
        if (track && track.getCapabilities && track.getCapabilities().torch) {
          await track.applyConstraints({
            advanced: [{ torch: !isTorchOn }]
          });
          setIsTorchOn(!isTorchOn);
        } else {
          toast.warning("Torch not available on this device");
        }
      }
    } catch (error) {
      console.error("Error toggling torch:", error);
      toast.error("Failed to toggle torch");
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      socket.emit("participant_muted", { callId, isMuted: !isMuted });
    }
  };

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
    }
  };

  // Camera toggle function with improved track replacement
  const toggleCamera = async () => {
    try {
      if (!peerConnectionRef.current) {
        console.error("No peer connection available");
        return;
      }

      const newIsBackCamera = !isBackCamera;
      console.log("Switching to camera:", newIsBackCamera ? "back" : "front");

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

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false // We'll handle audio separately
      });

      // Get a new audio track
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
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

      // Remove all existing senders
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

      console.log("Camera switch completed successfully");
    } catch (error) {
      console.error("Error switching camera:", error);
      toast.error("Failed to switch camera. Please try again.");
    }
  };

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

  const handleConnectionStateChange = () => {
    if (!peerConnectionRef.current) return;

    const state = peerConnectionRef.current.connectionState;
    console.log("Connection state changed:", state);

    switch (state) {
      case "disconnected":
        // Try to reconnect with exponential backoff
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
        console.log(
          `Attempting reconnection in ${delay /
            1000} seconds (attempt ${reconnectAttemptRef.current + 1})`
        );

        toast.warning(
          `Connection interrupted. Reconnecting in ${Math.ceil(
            delay / 1000
          )} seconds...`
        );

        setTimeout(async () => {
          try {
            reconnectAttemptRef.current++;
            await initializeCall(true);
            toast.success("Reconnected successfully");
            reconnectAttemptRef.current = 0;
          } catch (error) {
            console.error("Reconnection attempt failed:", error);
            handleConnectionStateChange(); // Try again with increased backoff
          }
        }, delay);
        break;

      case "failed":
        toast.error(
          "Connection failed. Please check your internet connection."
        );
        // After multiple failures, suggest ending the call
        if (reconnectAttemptRef.current >= 5) {
          toast.error(
            "Unable to establish a stable connection. Consider ending the call and trying again."
          );
        }
        break;

      case "connected":
        console.log("Connected to peer");
        toast.success("Connected to peer");
        reconnectAttemptRef.current = 0;
        break;

      default:
        // Do nothing for other states
        break;
    }
  };

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
  
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = videoToCapture.videoWidth;
      canvas.height = videoToCapture.videoHeight;
  
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
      const screenshotDataUrl = canvas.toDataURL("image/jpeg", 0.95); // Higher quality JPEG
  
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
          const s3Url = await uploadScreenshot(
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
                progress
              }));
            }
          );
  
          // Update the screenshot with the S3 URL
          setMessages(prev =>
            prev.map(msg =>
              msg.id === screenshot.id ? { ...msg, s3Url: s3Url } : msg
            )
          );
  
          // Save screenshot to server and notify other participants
          socket.emit("save_screenshot", {
            callId,
            s3Url,  // Send S3 URL instead of the full screenshot data
            timestamp: timestamp,
            location: locationInfo,
            capturedBy: role,
            claimNumber: claimNumber || null
          });
  
          toast.success("Screenshot saved to cloud storage");
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });
        } catch (error) {
          console.error("Failed to upload screenshot to S3:", error);
          toast.error("Failed to save screenshot to cloud storage");
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });
        }
      } else {
        // If no claim number, just emit with the data URL
        socket.emit("save_screenshot", {
          callId,
          screenshot: screenshotDataUrl, // Use the data URL if no S3 upload was done
          timestamp: timestamp,
          location: locationInfo,
          capturedBy: role,
          claimNumber: null
        });
      }
    } catch (error) {
      console.error("Error taking screenshot:", error);
      toast.error("Failed to capture screenshot");
      setUploadStatus({
        uploading: false,
        progress: 0,
        type: null,
        fileName: null
      });
    }
  };

  const toggleRecording = async () => {
    if (!claimNumber) {
      toast.error("Cannot record: No claim number provided");
      return;
    }

    try {
      if (isRecording) {
        // Stop recording logic
        if (role === "supervisor") {
          toast.info("Stopping recording...");
          socket.emit("recording_status", {
            callId,
            isRecording: false,
            stoppedBy: role,
            timestamp: new Date().toISOString()
          });
        } else if (role === "investigator") {
          if (!recordingStateRef.current?.mediaRecorder) {
            toast.error("No active recording found");
            setIsRecording(false);
            return;
          }

          toast.info("Stopping recording and preparing upload...");
          recordingStateRef.current.mediaRecorder.stop();
        }
      } else {
        // Start recording logic
        if (role === "supervisor") {
          toast.info("Requesting investigator to start recording...");
          socket.emit("recording_status", {
            callId,
            isRecording: true,
            startedBy: role,
            timestamp: new Date().toISOString()
          });
        } else if (role === "investigator") {
          await startRecordingInvestigator();
        }
      }
    } catch (error) {
      console.error("Error in toggleRecording:", error);
      toast.error(`Recording error: ${error.message}`);
      setIsRecording(false);
      recordingStateRef.current = null;
    }
  };
  const startRecordingInvestigator = async () => {
    try {
      const stream = localVideoRef.current?.srcObject;
      if (!stream) {
        throw new Error("No video stream available");
      }

      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error("No video track available");
      }

      // Get supported MIME type based on browser/device
      const getSupportedMimeType = () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);

        if (isIOS) {
          // iOS specific MIME types in order of preference
          const iOSTypes = [
            "video/mp4",
            "video/quicktime",
            "video/mp4;codecs=h264,aac"
          ];

          for (const type of iOSTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
              console.log("Using iOS MIME type:", type);
              return type;
            }
          }

          // Fallback for iOS
          console.log("Using default iOS recording");
          return "";
        }

        // Other platforms
        const types = [
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=h264,opus",
          "video/webm",
          "video/mp4;codecs=h264,aac",
          "video/mp4"
        ];

        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            console.log("Using MIME type:", type);
            return type;
          }
        }

        return "video/webm"; // Default fallback
      };

      const mimeType = getSupportedMimeType();
      console.log("Selected MIME type:", mimeType);

      const mediaRecorderOptions = {
        videoBitsPerSecond: 2500000
      };

      if (mimeType) {
        mediaRecorderOptions.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
      const chunks = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
          console.log("Received chunk:", event.data.size, "bytes");
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          if (chunks.length === 0) {
            throw new Error("No video data collected");
          }

          // Use correct MIME type for Blob creation
          const blobMimeType = mimeType || "video/mp4";
          const recordedBlob = new Blob(chunks, { type: blobMimeType });

          if (recordedBlob.size === 0) {
            throw new Error("Generated video blob is empty");
          }

          console.log("Video blob size:", recordedBlob.size, "bytes");
          const previewUrl = URL.createObjectURL(recordedBlob);
          setRecordingUrl(previewUrl);

          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const fileExtension = blobMimeType.includes("webm") ? "webm" : "mp4";
          const fileName = `recording-${timestamp}.${fileExtension}`;

          setUploadStatus({
            uploading: true,
            progress: 0,
            type: "recording",
            fileName
          });

          // Upload directly using uploadRecording
          const s3Key = `recordings/claim-${claimNumber}/call-${callId}/${timestamp}.${fileExtension}`;
          const url = await uploadRecording(
            claimNumber,
            callId,
            recordedBlob,
            {
              startTime: recordingStateRef.current.startTime.toISOString(),
              endTime: new Date().toISOString(),
              duration:
                (new Date() - recordingStateRef.current.startTime) / 1000
            },
            progress => {
              setUploadStatus(prev => ({
                ...prev,
                progress
              }));
            }
          );

          setMessages(prev => [
            ...prev,
            {
              type: "recording",
              url: url,
              previewUrl: previewUrl,
              timestamp: new Date().toISOString(),
              recordedBy: role,
              message: `Recording from ${new Date().toLocaleString()}`,
              isLocal: true
            }
          ]);

          toast.success("Recording saved successfully");

          socket.emit("recording_completed", {
            callId,
            recordingUrl: url,
            recordedBy: role,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error("Error processing recording:", error);
          toast.error(`Failed to save recording: ${error.message}`);
          socket.emit("recording_error", {
            callId,
            error: { message: error.message }
          });
        } finally {
          setIsRecording(false);
          setUploadStatus({
            uploading: false,
            progress: 0,
            type: null,
            fileName: null
          });
          recordingStateRef.current = null;
        }
      };

      recordingStateRef.current = {
        mediaRecorder,
        chunks,
        startTime: new Date(),
        stopped: false,
        stopRecording: () => {
          return new Promise((resolve, reject) => {
            try {
              if (!recordingStateRef.current?.mediaRecorder) {
                throw new Error("No active recording found");
              }

              if (
                recordingStateRef.current.mediaRecorder.state === "inactive"
              ) {
                throw new Error("Recording already stopped");
              }

              recordingStateRef.current.mediaRecorder.stop();
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        }
      };

      // Request data in smaller chunks for iOS
      mediaRecorder.start(1000);
      setIsRecording(true);
      toast.info("Recording started");

      socket.emit("recording_status", {
        callId,
        isRecording: true,
        startedBy: role,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error(`Failed to start recording: ${error.message}`);
      setIsRecording(false);
      recordingStateRef.current = null;
    }
  };
  // Enhanced recording state management for better sync
  const startCallRecording = async () => {
    if (!claimNumber || claimNumber.trim() === "") {
      console.error("Cannot start recording: No claim number provided");
      toast.error("Cannot start recording: No claim number provided");
      return;
    }

    try {
      if (role === "supervisor") {
        toast.info("Starting recording on investigator device...");
        socket.emit("recording_status", {
          callId,
          isRecording: true,
          startedBy: role,
          timestamp: new Date().toISOString()
        });
        setIsRecording(true);
      } else if (role === "investigator") {
        const stream = localVideoRef.current?.srcObject;
        if (!stream) {
          throw new Error("No video stream available to record");
        }

        // Validate video tracks
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length === 0) {
          throw new Error("No video track available");
        }

        // Set up MediaRecorder with optimized settings
        const options = {
          mimeType: MediaRecorder.isTypeSupported(
            "video/mp4; codecs='avc1.42E01E, mp4a.40.2'"
          )
            ? "video/mp4; codecs='avc1.42E01E, mp4a.40.2'"
            : MediaRecorder.isTypeSupported("video/webm; codecs='vp9, opus'")
            ? "video/webm; codecs='vp9, opus'"
            : MediaRecorder.isTypeSupported("video/mp4")
            ? "video/mp4"
            : MediaRecorder.isTypeSupported("video/webm")
            ? "video/webm"
            : "",
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        };

        // Initialize recording state
        const recordingState = {
          mediaRecorder: null,
          chunks: [],
          startTime: new Date(),
          stopped: false
        };

        // Create MediaRecorder
        recordingState.mediaRecorder = new MediaRecorder(stream, options);

        // Handle data available event
        recordingState.mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            recordingState.chunks.push(event.data);
          }
        };

        // Handle recording stop
        recordingState.mediaRecorder.onstop = async () => {
          if (recordingState.stopped) return; // Prevent multiple executions
          recordingState.stopped = true;

          try {
            const recordedBlob = new Blob(recordingState.chunks, {
              type: "video/webm"
            });

            // Generate unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `recordings/claim-${claimNumber}/call-${callId}/${timestamp}.webm`;

            // Update UI to show upload progress
            setUploadStatus({
              uploading: true,
              progress: 0,
              type: "recording",
              fileName
            });

            // Upload to S3 with enhanced error handling and retry logic
            const uploadWithRetry = async (retries = 3) => {
              try {
                const url = await uploadToS3(fileName, recordedBlob, {
                  contentType: "video/webm",
                  metadata: {
                    claimNumber,
                    callId,
                    startTime: recordingState.startTime.toISOString(),
                    endTime: new Date().toISOString(),
                    duration: (new Date() - recordingState.startTime) / 1000
                  },
                  progressCallback: progress => {
                    setUploadStatus(prev => ({
                      ...prev,
                      progress
                    }));
                  }
                });

                // Notify successful upload
                socket.emit("recording_completed", {
                  callId,
                  recordingUrl: url,
                  recordedBy: role,
                  timestamp: new Date().toISOString()
                });

                return url;
              } catch (error) {
                if (retries > 0) {
                  console.warn(
                    `Upload failed, retrying... (${retries} attempts left)`
                  );
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  return uploadWithRetry(retries - 1);
                }
                throw error;
              }
            };

            const url = await uploadWithRetry();

            // Reset states after successful upload
            setRecordingUrl(url);
            setIsRecording(false);
            setUploadStatus({
              uploading: false,
              progress: 100,
              type: null,
              fileName: null
            });

            toast.success("Recording saved successfully");
          } catch (error) {
            console.error("Failed to process recording:", error);
            toast.error("Failed to save recording");

            socket.emit("recording_error", {
              callId,
              error: { message: error.message }
            });

            setUploadStatus({
              uploading: false,
              progress: 0,
              type: null,
              fileName: null
            });
          }
        };

        // Start recording
        recordingState.mediaRecorder.start(1000); // Save in 1-second chunks
        recordingStateRef.current = recordingState;
        setIsRecording(true);

        // Notify others
        socket.emit("recording_status", {
          callId,
          isRecording: true,
          startedBy: role,
          timestamp: new Date().toISOString()
        });

        toast.info("Recording started");
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error(`Failed to start recording: ${error.message}`);

      socket.emit("recording_error", {
        callId,
        error: { message: error.message }
      });

      setIsRecording(false);
      setUploadStatus({
        uploading: false,
        progress: 0,
        type: null,
        fileName: null
      });
    }
  };

  // Enhanced stop recording function
  const stopRecording = async () => {
    try {
      if (role === "supervisor") {
        socket.emit("recording_status", {
          callId,
          isRecording: false,
          stoppedBy: role,
          timestamp: new Date().toISOString()
        });
        setIsRecording(false);
      } else if (role === "investigator") {
        if (!recordingStateRef.current?.mediaRecorder) {
          console.warn("No active recording to stop");
          setIsRecording(false);
          return;
        }

        // Stop the MediaRecorder
        recordingStateRef.current.mediaRecorder.stop();

        // Notify others
        socket.emit("recording_status", {
          callId,
          isRecording: false,
          stoppedBy: role,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast.error("Failed to stop recording");

      socket.emit("recording_error", {
        callId,
        error: { message: error.message }
      });

      setIsRecording(false);
      setUploadStatus({
        uploading: false,
        progress: 0,
        type: null,
        fileName: null
      });
    }
  };
  // Enhanced screen sharing with better error handling
  const toggleScreenSharing = async () => {
    if (isScreenSharing) {
      await stopScreenSharing();
    } else {
      await startScreenSharing();
    }
  };

  const startScreenSharing = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
          logicalSurface: true,
          frameRate: 30
        }
      });

      // Store reference to the screen stream for cleanup
      screenStreamRef.current = screenStream;

      // Replace video track
      const videoTrack = screenStream.getVideoTracks()[0];

      if (!videoTrack) {
        throw new Error("No video track available in screen share");
      }

      // Listen for the end of screen sharing
      videoTrack.addEventListener("ended", () => {
        stopScreenSharing();
      });

      const sender = peerConnectionRef.current
        .getSenders()
        .find(s => s.track && s.track.kind === "video");

      if (sender) {
        await sender.replaceTrack(videoTrack);
        setIsScreenSharing(true);

        // Update local preview to show screen share
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        toast.info("Screen sharing started");

        // Let the other person know we're screen sharing
        socket.emit("screen_sharing_status", {
          callId,
          isScreenSharing: true
        });
      } else {
        throw new Error("No video sender found in peer connection");
      }
    } catch (error) {
      console.error("Error sharing screen:", error);
      // Handle user cancellation differently
      if (
        error.name === "NotAllowedError" ||
        error.message.includes("Permission denied")
      ) {
        toast.info("Screen sharing was cancelled");
      } else {
        toast.error(`Failed to share screen: ${error.message}`);
      }

      // Cleanup any partial screen share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
    }
  };

  const stopScreenSharing = async () => {
    try {
      // Stop all screen share tracks
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Get new camera stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: isBackCamera ? "environment" : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      // Replace the video track
      const sender = peerConnectionRef.current
        .getSenders()
        .find(s => s.track && s.track.kind === "video");

      if (sender) {
        const videoTrack = newStream.getVideoTracks()[0];
        await sender.replaceTrack(videoTrack);

        // Update local video preview
        if (localVideoRef.current) {
          // Add the audio track from the existing stream if available
          if (
            mediaStreamRef.current &&
            mediaStreamRef.current.getAudioTracks().length > 0
          ) {
            newStream.addTrack(mediaStreamRef.current.getAudioTracks()[0]);
          }

          localVideoRef.current.srcObject = newStream;
          localVideoRef.current.classList.toggle("mirror-video", !isBackCamera);
        }

        // Update mediaStreamRef with the new stream
        mediaStreamRef.current = newStream;
        setLocalStream(newStream);
      }

      setIsScreenSharing(false);
      toast.info("Screen sharing stopped");

      // Notify other participant
      socket.emit("screen_sharing_status", {
        callId,
        isScreenSharing: false
      });
    } catch (error) {
      console.error("Error stopping screen share:", error);
      toast.error(`Failed to stop screen sharing: ${error.message}`);
    }
  };

  // WebRTC handler
  useEffect(() => {
    if (!socket || !isCallInitialized) return;

    const handleVideoOffer = async ({ offer }) => {
      try {
        console.log("Received video offer");
        if (!peerConnectionRef.current) {
          console.log("Creating new peer connection for offer");
          peerConnectionRef.current = new RTCPeerConnection(configuration);
          setupPeerConnectionHandlers();
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
        }

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit("video_answer", { callId, answer });
      } catch (error) {
        console.error("Error handling video offer:", error);
        toast.error("Failed to process incoming video");
      }
    };

    const handleVideoAnswer = async ({ answer }) => {
      try {
        console.log("Received video answer");
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          console.log("Remote description set successfully");
        }
      } catch (error) {
        console.error("Error handling video answer:", error);
        toast.error("Failed to establish video connection");
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        console.log("Received ICE candidate");
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    };

    const handleScreenSharingStatus = ({
      isScreenSharing: remoteSharingScreen
    }) => {
      if (remoteSharingScreen) {
        toast.info("Remote participant is sharing their screen");
      } else {
        toast.info("Remote participant stopped sharing their screen");
      }
    };

    // Set up signaling handlers
    socket.on("video_offer", handleVideoOffer);
    socket.on("video_answer", handleVideoAnswer);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("screen_sharing_status", handleScreenSharingStatus);

    // Create and send offer if investigator
    const createOffer = async () => {
      if (role === "investigator" && peerConnectionRef.current) {
        try {
          console.log("Creating offer as investigator");
          const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit("video_offer", { callId, offer });
        } catch (error) {
          console.error("Error creating offer:", error);
          toast.error("Failed to start video call");
        }
      }
    };

    createOffer();

    return () => {
      socket.off("video_offer", handleVideoOffer);
      socket.off("video_answer", handleVideoAnswer);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("screen_sharing_status", handleScreenSharingStatus);
    };
  }, [socket, isCallInitialized, role, localStream]);

  // Chat and location socket handlers
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = data => {
      console.log("Received chat message:", data);
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
              console.error("Failed to play notification sound:", err)
            );
        }
      }
    };

    const handleLocationUpdate = data => {
      console.log("Received location update:", data);
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
                !isBackCamera && !isScreenSharing ? "mirror-video" : ""
              }`}
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

          <div className="video-controls-mobile">
            <button
              onClick={toggleCamera}
              disabled={!isCameraReady}
              title="Switch Camera"
            >
              {isBackCamera ? <FaCameraRetro /> : <FaCamera />}
            </button>
            {role === "investigator" && (
              <button
                onClick={toggleTorch}
                disabled={!isCameraReady}
                title="Toggle Torch"
              >
                <FaLightbulb className={isTorchOn ? "torch-on" : ""} />
              </button>
            )}
            <button onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </button>
            <button
              onClick={toggleVideo}
              title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
            >
              {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
            </button>
            <button
              onClick={toggleScreenSharing}
              className={isScreenSharing ? "active" : ""}
              title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
            >
              {isScreenSharing ? <FaStop /> : <FaDesktop />}
            </button>
            <button
              onClick={toggleChat}
              className={unreadMessages > 0 ? "has-notification" : ""}
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
            </button>
            <button
              onClick={toggleRecording}
              className={isRecording ? "recording" : ""}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? <FaVideoSlash /> : <FaVideo />}
            </button>
            <button
              onClick={handleEndCall}
              className="end-call"
              title="End Call"
            >
              <FaPhoneSlash />
            </button>
            <button
              onClick={takeScreenshot}
              disabled={!isCameraReady}
              title="Take Screenshot"
            >
              <FaImage />
            </button>
            <button
              onClick={toggleSettings}
              className="settings-button"
              title="Settings"
            >
              <FaCog />
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
              className="video-large-stream"
            />
            <div className="stream-label">Investigator Camera</div>
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
            {callStats.resolution && (
              <div className="resolution-info">{callStats.resolution}</div>
            )}
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

          {/* Side panel for participants */}
          <div className="side-panel">
            {/* Supervisor's preview */}
            <div className="participant-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`video-small ${
                  !isBackCamera && !isScreenSharing ? "mirror-video" : ""
                }`}
              />
              <div className="participant-label">You</div>
            </div>

            {/* Web controls */}
            <div className="video-controls-web">
              <button onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
              </button>
              <button
                onClick={toggleVideo}
                title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
              >
                {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
              </button>
              <button
                onClick={toggleScreenSharing}
                className={isScreenSharing ? "active" : ""}
                title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
              >
                {isScreenSharing ? <FaStop /> : <FaDesktop />}
              </button>
              <button
                onClick={toggleChat}
                className={unreadMessages > 0 ? "has-notification" : ""}
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
              </button>
              <button
                onClick={toggleRecording}
                className={isRecording ? "recording" : ""}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                {isRecording ? <FaVideoSlash /> : <FaVideo />}
              </button>
              <button
                onClick={handleEndCall}
                className="end-call"
                title="End Call"
              >
                <FaPhoneSlash />
              </button>
              <button
                onClick={takeScreenshot}
                disabled={!remoteStream}
                title="Take Screenshot"
              >
                <FaImage />
              </button>
              <button
                onClick={toggleSettings}
                className="settings-button"
                title="Settings"
              >
                <FaCog />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Call Settings</h3>
            <button className="close-button" onClick={toggleSettings}>
              ×
            </button>
          </div>
          <div className="settings-content">
            <div className="settings-section">
              <h4>Connection Info</h4>
              <div className="settings-info">
                <p>Duration: {formatDuration(callStats.duration)}</p>
                <p>
                  Quality:{" "}
                  <span className={callStats.connectionQuality}>
                    {callStats.connectionQuality}
                  </span>
                </p>
                <p>Bandwidth: {callStats.bandwidth} kbps</p>
                <p>Resolution: {callStats.resolution || "Unknown"}</p>
                <p>
                  Data Transferred: {formatBytes(callStats.bytesTransferred)}
                </p>
                <p>Claim Number: {claimNumber || "Not provided"}</p>
              </div>
            </div>

            <div className="settings-section">
              <h4>Available Devices</h4>
              {availableDevices.cameras.length > 0 ? (
                <>
                  <label>Cameras:</label>
                  <select className="device-select">
                    {availableDevices.cameras.map(camera => (
                      <option key={camera.id} value={camera.id}>
                        {camera.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p>No cameras detected</p>
              )}

              {availableDevices.microphones.length > 0 ? (
                <>
                  <label>Microphones:</label>
                  <select className="device-select">
                    {availableDevices.microphones.map(mic => (
                      <option key={mic.id} value={mic.id}>
                        {mic.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p>No microphones detected</p>
              )}
            </div>

            <div className="settings-section">
              <h4>Media Controls</h4>
              <div className="settings-controls">
                <button onClick={toggleMute}>
                  {isMuted ? "Unmute Microphone" : "Mute Microphone"}
                </button>
                <button onClick={toggleVideo}>
                  {isVideoOff ? "Turn Video On" : "Turn Video Off"}
                </button>
                {role === "investigator" && (
                  <button onClick={toggleCamera}>
                    Switch to {isBackCamera ? "Front" : "Back"} Camera
                  </button>
                )}
                <button onClick={toggleScreenSharing}>
                  {isScreenSharing
                    ? "Stop Screen Sharing"
                    : "Start Screen Sharing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Window */}
      {showChat && (
        <div
          className={`chat-window ${role} ${
            isChatMinimized ? "minimized" : ""
          }`}
        >
          <div className="chat-header">
            <span>Chat</span>
            <div className="chat-controls">
              <button
                className="minimize-button"
                onClick={() => setIsChatMinimized(!isChatMinimized)}
              >
                {isChatMinimized ? "□" : "−"}
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
                  .filter(msg => msg.type === "chat" || msg.message) // Only show chat messages
                  .map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${msg.isLocal ? "local" : "remote"}`}
                    >
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
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="submit">Send</button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Screenshots and recordings panel */}
      {messages.some(
        item => item.type === "screenshot" || item.type === "recording"
      ) && (
        <div className={`media-panel ${role}`}>
          <div className="media-panel-header">
            <h3>Media</h3>
          </div>
          <div className="media-items">
            {messages
              .filter(
                item => item.type === "screenshot" || item.type === "recording"
              )
              .map((item, index) => (
                <div key={index} className={`media-item ${item.type}`}>
                  {item.type === "screenshot" ? (
                    <img
                      src={item.url}
                      alt={`Screenshot ${index + 1}`}
                      onClick={() => handleScreenshotClick(item)}
                    />
                  ) : (
                    <div className="recording-item">
                      <span>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FaDownload /> Recording
                      </a>
                    </div>
                  )}
                  <div className="media-timestamp">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div className="screenshot-modal" onClick={closeScreenshotModal}>
          <div
            className="screenshot-modal-content"
            onClick={e => e.stopPropagation()}
          >
            <span className="close-modal" onClick={closeScreenshotModal}>
              &times;
            </span>
            <img src={selectedScreenshot.url} alt="Full-size screenshot" />
            <div className="screenshot-info">
              <p className="screenshot-timestamp">
                Taken: {selectedScreenshot.timestampText}
              </p>
              {selectedScreenshot.locationText && (
                <p className="screenshot-location">
                  Location: {selectedScreenshot.locationText}
                </p>
              )}
              {selectedScreenshot.capturedBy && (
                <p className="screenshot-author">
                  Captured by: {selectedScreenshot.capturedBy}
                </p>
              )}
              {selectedScreenshot.s3Url && (
                <p className="screenshot-storage">
                  <a
                    href={selectedScreenshot.s3Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="download-link"
                  >
                    <FaDownload /> Download full resolution
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

      {/* Recording preview */}
      {recordingUrl && (
        <video controls src={recordingUrl} className="recording-preview" />
      )}
    </div>
  );
};

export default VideoCall;