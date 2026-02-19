import { useEffect, useRef } from "react";



interface UseWebRTCProps {
  socket: any;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
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
    
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
        console.log("[WebRTC] Created new remote stream");
      }
    
      remoteStreamRef.current.addTrack(event.track);
      console.log("[WebRTC] Added track to remote stream. Total tracks:", remoteStreamRef.current.getTracks().length);
    
      const remoteVideo = remoteVideoRef.current;
      if (!remoteVideo) {
        console.warn("[WebRTC] ⚠️ remoteVideoRef.current is null - cannot set remote stream");
        return;
      }
    
      if (remoteVideo.srcObject !== remoteStreamRef.current) {
        console.log("[WebRTC] Setting remote video srcObject");
        remoteVideo.srcObject = remoteStreamRef.current;
        remoteVideo.playsInline = true;
        remoteVideo.autoplay = true;
        remoteVideo.muted = false; // Remote video should not be muted
        console.log("[WebRTC] ✅ Remote video element configured");
      }
    
      // Check video dimensions after setting srcObject
      const checkDimensions = () => {
        if (remoteVideo) {
          const width = remoteVideo.videoWidth;
          const height = remoteVideo.videoHeight;
          const readyState = remoteVideo.readyState;
          
          console.log("[WebRTC] Remote video dimensions:", width, "x", height);
          console.log("[WebRTC] Remote video readyState:", readyState);
          console.log("[WebRTC] Remote video paused:", remoteVideo.paused);
          console.log("[WebRTC] Remote video currentTime:", remoteVideo.currentTime);
          console.log("[WebRTC] Remote video srcObject:", !!remoteVideo.srcObject);
          
          if (width === 0 && height === 0) {
            console.warn("[WebRTC] ⚠️ Video dimensions are 0x0 - video may not be rendering!");
            console.warn("[WebRTC] This could be a CSS issue (check width/height) or video not loaded yet");
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
    
      if (remoteVideo.paused) {
        remoteVideo.play()
          .then(() => {
            console.log("[WebRTC] ✅ Remote video started playing");
            // Check dimensions after play
            setTimeout(checkDimensions, 100);
          })
          .catch(err => {
            console.error("[WebRTC] ❌ Error playing remote video:", err);
            console.error("[WebRTC] Error details:", err.name, err.message);
          });
      } else {
        console.log("[WebRTC] Remote video already playing");
        checkDimensions();
      }
      
      // Periodic dimension check to catch rendering issues
      const dimensionCheckInterval = setInterval(() => {
        if (remoteVideo) {
          const width = remoteVideo.videoWidth;
          const height = remoteVideo.videoHeight;
          if (width > 0 && height > 0) {
            console.log("[WebRTC] ✅ Remote video rendering:", width, "x", height);
            clearInterval(dimensionCheckInterval);
          } else {
            console.log("[WebRTC] Still waiting for video dimensions...");
          }
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        clearInterval(dimensionCheckInterval);
        if (remoteVideo && remoteVideo.videoWidth === 0 && remoteVideo.videoHeight === 0) {
          console.error("[WebRTC] ❌ Video dimensions still 0x0 after 10 seconds - likely CSS or rendering issue!");
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
