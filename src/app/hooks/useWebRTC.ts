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
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
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

    // Receive remote stream - simplified approach like working Omegle clones
    pc.ontrack = (event) => {
      console.log("[WebRTC] 📹 ontrack event received!");
      console.log("[WebRTC] Track kind:", event.track.kind);
      console.log("[WebRTC] Streams count:", event.streams.length);
    
      const remoteVideo = remoteVideoRef.current;
      if (!remoteVideo) {
        console.warn("[WebRTC] ⚠️ remoteVideoRef.current is null");
        return;
      }
    
      // Use the stream from the event (standard WebRTC approach)
      if (event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];
        console.log("[WebRTC] Setting remote stream with", remoteStream.getTracks().length, "tracks");
        
        // Simple direct assignment - no delays, no complex checks
        remoteVideo.srcObject = remoteStream;
        
        // Ensure video attributes are set
        remoteVideo.playsInline = true;
        remoteVideo.autoplay = true;
        remoteVideo.muted = false;
        
        // Try to play
        remoteVideo.play().catch(err => {
          console.error("[WebRTC] Error playing remote video:", err);
        });
        
        console.log("[WebRTC] ✅ Remote video stream set");
      } else if (event.track) {
        // Fallback: build stream from track
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        remoteVideo.srcObject = remoteStreamRef.current;
        remoteVideo.playsInline = true;
        remoteVideo.autoplay = true;
        remoteVideo.muted = false;
        remoteVideo.play().catch(err => {
          console.error("[WebRTC] Error playing remote video:", err);
        });
        console.log("[WebRTC] ✅ Remote video stream built from track");
      }
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

    // Create offer (modern WebRTC automatically includes tracks we added)
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

    // Create answer (modern WebRTC automatically includes tracks we added)
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
