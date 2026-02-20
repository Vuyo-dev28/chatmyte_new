import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCProps {
  socket: Socket;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
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

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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
        await localVideoRef.current.play().catch(() => {});
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
      if (event.candidate && partnerId) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: partnerId
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
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
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

  }, [initializeMedia, partnerId, socket, remoteVideoRef]);

  // ===============================
  // 3️⃣ Create Offer
  // ===============================
  const createOffer = useCallback(async (targetId: string) => {
    const pc = await initializePeerConnection();

    console.log("📤 Creating offer...");

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await pc.setLocalDescription(offer);

    socket.emit("offer", {
      offer,
      to: targetId
    });

  }, [initializePeerConnection, socket]);

  // ===============================
  // 4️⃣ Handle Offer
  // ===============================
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    const pc = await initializePeerConnection();

    console.log("📥 Handling offer...");

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
      answer,
      to: from
    });

  }, [initializePeerConnection, socket]);

  // ===============================
  // 5️⃣ Handle Answer
  // ===============================
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    console.log("📥 Handling answer...");

    await pc.setRemoteDescription(new RTCSessionDescription(answer));

  }, []);

  // ===============================
  // 6️⃣ Handle ICE Candidate
  // ===============================
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
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

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
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