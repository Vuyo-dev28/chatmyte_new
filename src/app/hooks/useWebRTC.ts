import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCProps {
  socket: Socket;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  partnerId: string | null;
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export const useWebRTC = ({
  socket,
  localVideoRef,
  remoteVideoRef,
  isVideoEnabled,
  isAudioEnabled,
  partnerId
}: UseWebRTCProps) => {

  const partnerIdRef = useRef<string | null>(partnerId);

  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);

  // ===============================
  // 1️⃣ Initialize Media (ONLY ONCE)
  // ===============================
  const initializeMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      console.log("🎥 Requesting media...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => { });
      }

      console.log("✅ Media initialized");
      return stream;

    } catch (error) {
      console.error("❌ Media error:", error);
      return null;
    }
  }, [localVideoRef]);

  // ===============================
  // 2️⃣ Create Peer Connection
  // ===============================
  const initializePeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log("🔗 Creating PeerConnection...");

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate && partnerIdRef.current) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          targetId: partnerIdRef.current
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
    };

    // Remote Track
    pc.ontrack = (event) => {
      console.log("📹 Remote track received");

      const remoteStream = event.streams[0];
      if (remoteVideoRef.current) {
        // Prevent redundant srcObject assignments which can trigger AbortError
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;

          // Use a flag or check if already playing to avoid overlapping play() calls
          remoteVideoRef.current.play().catch((err) => {
            if (err.name !== 'AbortError') {
              console.warn("[WebRTC] Error playing remote video:", err);
            }
          });
        }
      }
    };

    // Add local tracks BEFORE offer
    const stream = await initializeMedia();
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      console.log("✅ Local tracks added");
    }

    return pc;

  }, [initializeMedia, socket, remoteVideoRef]);

  // ===============================
  // 3️⃣ Create Offer
  // ===============================
  const createOffer = useCallback(async (targetId: string) => {
    const pc = await initializePeerConnection();

    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      if (pc.signalingState !== "stable") return;

      await pc.setLocalDescription(offer);

      socket.emit("offer", {
        offer,
        targetId: targetId
      });
    } catch (err) {
      console.error("❌ Offer creation error:", err);
    } finally {
      makingOfferRef.current = false;
    }

  }, [initializePeerConnection, socket]);

  // ===============================
  // 4️⃣ Handle Offer
  // ===============================
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    try {
      const pc = await initializePeerConnection();
      console.log(`📥 [Signaling] Handling offer from ${from}. State: ${pc.signalingState}`);

      const offerCollision =
        makingOfferRef.current || pc.signalingState !== "stable";

      const isPolite = !socket.id || (socket.id > from);
      ignoreOfferRef.current = isPolite && offerCollision;

      if (ignoreOfferRef.current) {
        console.warn("⚠️ [Signaling] Ignoring offer due to collision (polite peer logic)");
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log(`📥 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
        iceCandidateQueueRef.current.forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
            if (e.name !== 'InvalidStateError') console.error("❌ ICE error:", e);
          });
        });
        iceCandidateQueueRef.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", {
        answer,
        targetId: from
      });
    } catch (err) {
      console.error("❌ Offer handling error:", err);
    }

  }, [initializePeerConnection, socket]);

  // ===============================
  // 5️⃣ Handle Answer
  // ===============================
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      console.log("📥 Handling answer...");

      if (pc.signalingState !== "have-local-offer") {
        console.warn("⚠️ Received answer in wrong state:", pc.signalingState);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Process queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log(`📥 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
        iceCandidateQueueRef.current.forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {
            if (e.name !== 'InvalidStateError') console.error("❌ ICE error:", e);
          });
        });
        iceCandidateQueueRef.current = [];
      }
    } catch (err) {
      console.error("❌ Answer handling error:", err);
    }
  }, []);

  // ===============================
  // 6️⃣ Handle ICE Candidate
  // ===============================
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log("⏳ Queueing ICE candidate (remote description not set)");
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (error) {
      console.error("❌ ICE error:", error);
    }
  }, []);

  // ===============================
  // 7️⃣ Toggle Tracks
  // ===============================
  useEffect(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = isVideoEnabled;
    });

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = isAudioEnabled;
    });

  }, [isVideoEnabled, isAudioEnabled]);

  // ===============================
  // 8️⃣ Cleanup
  // ===============================
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up WebRTC...");

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    makingOfferRef.current = false;
    ignoreOfferRef.current = false;

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    iceCandidateQueueRef.current = [];
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup
  };
};