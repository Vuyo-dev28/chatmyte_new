import { useEffect, useRef } from "react";



interface UseWebRTCProps {
  socket: any;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  partnerId: string | null;
}

export const useWebRTC = ({
  socket,
  localVideoRef,
  remoteVideoRef,
  isVideoEnabled,
  isAudioEnabled,
  partnerId
}: UseWebRTCProps) => {

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  };

  /* ---------------------- INIT MEDIA ---------------------- */

  const initializeMedia = async () => {
    if (localStreamRef.current) {
      console.log("[WebRTC] Media already initialized, returning existing stream");
      return localStreamRef.current;
    }

    try {
      console.log("[WebRTC] Requesting camera access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log("[WebRTC] ✅ Camera stream received:", stream);
      console.log("[WebRTC] Stream tracks:", stream.getTracks().map(t => `${t.kind} (${t.id})`));

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        console.log("[WebRTC] Setting video element srcObject");
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.playsInline = true;

        await localVideoRef.current.play().catch(err => {
          console.error("[WebRTC] Video play error:", err);
        });
        
        console.log("[WebRTC] ✅ Video element configured and playing");
      } else {
        console.warn("[WebRTC] ⚠️ localVideoRef.current is null - video element not ready");
      }

      return stream;

    } catch (error) {
      console.error("[WebRTC] ❌ getUserMedia FAILED:", error);
      console.error("[WebRTC] Error name:", (error as any)?.name);
      console.error("[WebRTC] Error message:", (error as any)?.message);
      
      // Show user-friendly error
      if ((error as any)?.name === 'NotAllowedError' || (error as any)?.name === 'PermissionDeniedError') {
        alert("Camera permission denied. Please allow camera access in your browser settings.");
      } else if ((error as any)?.name === 'NotFoundError' || (error as any)?.name === 'DevicesNotFoundError') {
        alert("No camera or microphone found. Please connect a camera and try again.");
      } else {
        alert("Camera permission denied or unavailable. Please check your browser settings.");
      }
      
      return null;
    }
  };

  /* ---------------------- INIT PEER ---------------------- */

  const initializePeerConnection = async () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(iceServers);

    peerConnectionRef.current = pc;

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && partnerId) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: partnerId
        });
      }
    };

    // Receive remote stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] 📹 ontrack event received!");
      console.log("[WebRTC] Track kind:", event.track.kind);
      console.log("[WebRTC] Track id:", event.track.id);
      console.log("[WebRTC] Track readyState:", event.track.readyState);
      console.log("[WebRTC] Track enabled:", event.track.enabled);
      console.log("[WebRTC] Streams count:", event.streams.length);
    
      const remoteVideo = remoteVideoRef.current;
      if (!remoteVideo) {
        console.warn("[WebRTC] ⚠️ remoteVideoRef.current is null - cannot set remote stream");
        return;
      }
    
      // Build a complete stream with all tracks (audio + video)
      // Use the stream from the event if available, otherwise build our own
      let streamToUse: MediaStream;
      
      if (event.streams && event.streams.length > 0) {
        // Use the stream from the event (this is the standard approach)
        streamToUse = event.streams[0];
        console.log("[WebRTC] Using stream from event.streams[0]");
      } else {
        // Fallback: build stream from tracks
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
          console.log("[WebRTC] Created new remote stream");
        }
        // Add the track to our stream (both audio and video)
        remoteStreamRef.current.addTrack(event.track);
        console.log("[WebRTC] Added", event.track.kind, "track to remote stream");
        streamToUse = remoteStreamRef.current;
      }
      
      const videoTracks = streamToUse.getVideoTracks();
      console.log("[WebRTC] Stream video tracks:", videoTracks.length);
      console.log("[WebRTC] Stream all tracks:", streamToUse.getTracks().map(t => `${t.kind} (${t.id}, ${t.readyState}, enabled: ${t.enabled})`));
      
      // Verify we have video tracks
      if (videoTracks.length === 0) {
        console.error("[WebRTC] ❌ No video tracks in stream! Cannot display video.");
        return;
      }
      
      // Check if video track is live
      const videoTrack = videoTracks[0];
      console.log("[WebRTC] Video track details:", {
        id: videoTrack.id,
        readyState: videoTrack.readyState,
        enabled: videoTrack.enabled,
        label: videoTrack.label,
        muted: videoTrack.muted
      });
      
      // Try to get track settings (might fail in some browsers)
      try {
        const settings = videoTrack.getSettings();
        console.log("[WebRTC] Video track settings:", settings);
      } catch (e) {
        console.log("[WebRTC] Could not get video track settings:", e);
      }
      
      if (videoTrack.readyState !== 'live') {
        console.warn("[WebRTC] ⚠️ Video track is not live yet, readyState:", videoTrack.readyState);
        // Wait for track to become live
        const checkLive = setInterval(() => {
          if (videoTrack.readyState === 'live' && remoteVideoRef.current) {
            console.log("[WebRTC] ✅ Video track is now live!");
            clearInterval(checkLive);
            // Set srcObject now that track is live
            remoteVideoRef.current.srcObject = streamToUse;
            remoteVideoRef.current.playsInline = true;
            remoteVideoRef.current.autoplay = true;
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.play().catch(err => {
              console.error("[WebRTC] Error playing after track became live:", err);
            });
          }
        }, 100);
        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(checkLive), 5000);
        return; // Don't set srcObject yet
      }
      
      if (!videoTrack.enabled) {
        console.warn("[WebRTC] ⚠️ Video track is disabled! Enabling it...");
        videoTrack.enabled = true;
      }
      
      // Only set srcObject if it's different or if current srcObject has no video tracks
      const currentStream = remoteVideo.srcObject as MediaStream | null;
      const needsUpdate = !currentStream || 
                          currentStream.getVideoTracks().length === 0 || 
                          currentStream.getVideoTracks()[0].id !== videoTrack.id;
      
      if (needsUpdate) {
        console.log("[WebRTC] Setting remote video srcObject");
        
        // Clear any existing srcObject first
        if (remoteVideo.srcObject) {
          console.log("[WebRTC] Clearing existing srcObject");
          remoteVideo.srcObject = null;
        }
        
        // Small delay to ensure cleanup
        setTimeout(() => {
          if (!remoteVideoRef.current) return;
          
          remoteVideoRef.current.srcObject = streamToUse;
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.muted = false; // Remote video should not be muted
          
          console.log("[WebRTC] ✅ Remote video srcObject set");
          console.log("[WebRTC] Video element readyState:", remoteVideoRef.current.readyState);
          console.log("[WebRTC] Video element srcObject tracks:", (remoteVideoRef.current.srcObject as MediaStream)?.getTracks().length);
          
          // Force play
          remoteVideoRef.current.play()
            .then(() => {
              console.log("[WebRTC] ✅ Video play() succeeded");
              // Check dimensions after a short delay
              setTimeout(() => {
                if (remoteVideoRef.current) {
                  const width = remoteVideoRef.current.videoWidth;
                  const height = remoteVideoRef.current.videoHeight;
                  console.log("[WebRTC] Video dimensions after play:", width, "x", height);
                  if (width === 0 || height === 0) {
                    console.error("[WebRTC] ❌ Video dimensions still 0x0 after play - decoder issue!");
                  }
                }
              }, 500);
            })
            .catch(err => {
              console.error("[WebRTC] ❌ Video play() failed:", err);
            });
        }, 50);
      } else {
        console.log("[WebRTC] srcObject already set with correct stream, skipping update");
      }
      
      // Force video element to have dimensions
      if (remoteVideo.style.width === '' || remoteVideo.style.height === '') {
        remoteVideo.style.width = '100%';
        remoteVideo.style.height = '100%';
        console.log("[WebRTC] Set explicit width/height styles");
      }
      
      console.log("[WebRTC] ✅ Remote video element configured");
      console.log("[WebRTC] Video element computed style:", {
        width: window.getComputedStyle(remoteVideo).width,
        height: window.getComputedStyle(remoteVideo).height,
        display: window.getComputedStyle(remoteVideo).display,
        visibility: window.getComputedStyle(remoteVideo).visibility,
        zIndex: window.getComputedStyle(remoteVideo).zIndex
      });
    
      // Check video dimensions after setting srcObject
      const checkDimensions = () => {
        if (remoteVideo) {
          const width = remoteVideo.videoWidth;
          const height = remoteVideo.videoHeight;
          const readyState = remoteVideo.readyState;
          const rect = remoteVideo.getBoundingClientRect();
          
          console.log("[WebRTC] Remote video dimensions:", width, "x", height);
          console.log("[WebRTC] Remote video readyState:", readyState);
          console.log("[WebRTC] Remote video paused:", remoteVideo.paused);
          console.log("[WebRTC] Remote video currentTime:", remoteVideo.currentTime);
          console.log("[WebRTC] Remote video srcObject:", !!remoteVideo.srcObject);
          console.log("[WebRTC] Remote video element rect:", { width: rect.width, height: rect.height });
          
          if (width === 0 && height === 0) {
            console.warn("[WebRTC] ⚠️ Video dimensions are 0x0!");
            console.warn("[WebRTC] Element rect:", rect.width, "x", rect.height);
            if (rect.width === 0 || rect.height === 0) {
              console.error("[WebRTC] ❌ Element has 0 width/height - CSS issue!");
            }
          } else {
            console.log("[WebRTC] ✅ Video has dimensions - should be visible!");
          }
        }
      };
      
      // Check dimensions after metadata loads
      remoteVideo.onloadedmetadata = () => {
        console.log("[WebRTC] Remote video metadata loaded");
        checkDimensions();
      };
      
      // Also check on canplay
      remoteVideo.oncanplay = () => {
        console.log("[WebRTC] Remote video can play");
        checkDimensions();
      };
    
      // Try to play immediately
      remoteVideo.play()
        .then(() => {
          console.log("[WebRTC] ✅ Remote video started playing");
          // Check dimensions after play
          setTimeout(checkDimensions, 100);
        })
        .catch(err => {
          console.error("[WebRTC] ❌ Error playing remote video:", err);
          console.error("[WebRTC] Error details:", err.name, err.message);
          // Still check dimensions even if play failed
          setTimeout(checkDimensions, 100);
        });
      
      // Periodic dimension check to catch rendering issues
      const dimensionCheckInterval = setInterval(() => {
        if (remoteVideo) {
          const width = remoteVideo.videoWidth;
          const height = remoteVideo.videoHeight;
          const rect = remoteVideo.getBoundingClientRect();
          
          if (width > 0 && height > 0) {
            console.log("[WebRTC] ✅ Remote video rendering:", width, "x", height);
            clearInterval(dimensionCheckInterval);
          } else {
            console.log("[WebRTC] Still waiting for video dimensions...");
            console.log("[WebRTC] Element rect:", rect.width, "x", rect.height);
            if (rect.width === 0 || rect.height === 0) {
              console.error("[WebRTC] ❌ Element rect is 0x0 - CSS positioning issue!");
            }
          }
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        clearInterval(dimensionCheckInterval);
        if (remoteVideo) {
          const width = remoteVideo.videoWidth;
          const height = remoteVideo.videoHeight;
          const rect = remoteVideo.getBoundingClientRect();
          
          if (width === 0 && height === 0) {
            console.error("[WebRTC] ❌ Video dimensions still 0x0 after 10 seconds!");
            console.error("[WebRTC] Element rect:", rect.width, "x", rect.height);
            console.error("[WebRTC] This is likely a CSS issue - check parent container dimensions");
          }
        }
      }, 10000);
    };
    

    // Add local tracks
    const stream = await initializeMedia();

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    return pc;
  };

  /* ---------------------- CREATE OFFER ---------------------- */

  const createOffer = async (targetId: string) => {
    const pc = await initializePeerConnection();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
      offer,
      to: targetId
    });
  };

  /* ---------------------- HANDLE OFFER ---------------------- */

  const handleOffer = async (
    offer: RTCSessionDescriptionInit,
    fromId: string
  ) => {
    const pc = await initializePeerConnection();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
      answer,
      to: fromId
    });
  };

  /* ---------------------- HANDLE ANSWER ---------------------- */

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  };

  /* ---------------------- HANDLE ICE ---------------------- */

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  };

  /* ---------------------- START MEDIA IMMEDIATELY ---------------------- */

  useEffect(() => {
    // Start media immediately when component mounts
    console.log("[WebRTC] Component mounted - initializing media...");
    initializeMedia();
  }, []);

  /* ---------------------- TOGGLE TRACKS ---------------------- */

  useEffect(() => {
    if (!localStreamRef.current) return;

    console.log("[WebRTC] Toggling tracks - video:", isVideoEnabled, "audio:", isAudioEnabled);

    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = isVideoEnabled;
      console.log("[WebRTC] Video track", track.id, "enabled:", isVideoEnabled);
    });

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = isAudioEnabled;
      console.log("[WebRTC] Audio track", track.id, "enabled:", isAudioEnabled);
    });
  }, [isVideoEnabled, isAudioEnabled]);

  /* ---------------------- CLEANUP ---------------------- */

  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
  
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
  
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
        remoteStreamRef.current = null;
      }
  
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [partnerId]);
  

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate
  };
};
