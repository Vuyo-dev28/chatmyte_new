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
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);

  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  // ===============================
  // 🎥 Initialize Media
  // ===============================
  const initializeMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play().catch(() => { });
      }

      console.log("✅ Local media ready");
      return stream;

    } catch (err) {
      console.error("❌ Media error:", err);
      return null;
    }
  }, [localVideoRef]);

  // ===============================
  // 🔗 Create PeerConnection
  // ===============================
  const initializePeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    console.log("🔗 Creating PeerConnection...");
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate && partnerIdRef.current) {
        console.log("📤 ICE →", partnerIdRef.current);
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          targetId: partnerIdRef.current
        });
      }
    };

    // CONNECTION STATE
    pc.onconnectionstatechange = () => {
      console.log("🔗 Connection:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE state:", pc.iceConnectionState);
    };

    // ✅ FIXED REMOTE TRACK HANDLING
    pc.ontrack = (event) => {
      console.log("📹 Remote track:", event.track.kind);

      remoteStreamRef.current.addTrack(event.track);

      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;

          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.muted = true; // 🔥 IMPORTANT for autoplay

          remoteVideoRef.current.play().catch(() => { });
        }
      }
    };

    // ADD LOCAL TRACKS
    const stream = await initializeMedia();
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    return pc;

  }, [initializeMedia, socket, remoteVideoRef]);

  // ===============================
  // 📤 CREATE OFFER
  // ===============================
  const createOffer = useCallback(async (targetId: string) => {
    const pc = await initializePeerConnection();

    try {
      partnerIdRef.current = targetId;
      makingOfferRef.current = true;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("📤 Sending offer →", targetId);

      socket.emit("offer", {
        offer,
        targetId
      });

    } catch (err) {
      console.error("❌ Offer error:", err);
    } finally {
      makingOfferRef.current = false;
    }

  }, [initializePeerConnection, socket]);

  // ===============================
  // 📥 HANDLE OFFER
  // ===============================
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    try {
      const pc = await initializePeerConnection();
      partnerIdRef.current = from;

      console.log("📥 Offer from:", from);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("📤 Sending answer →", from);

      socket.emit("answer", {
        answer,
        targetId: from
      });

      // Flush ICE queue
      iceCandidateQueueRef.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      iceCandidateQueueRef.current = [];

    } catch (err) {
      console.error("❌ Handle offer error:", err);
    }

  }, [initializePeerConnection, socket]);

  // ===============================
  // 📥 HANDLE ANSWER
  // ===============================
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      console.log("📥 Answer received");

      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Flush ICE queue
      iceCandidateQueueRef.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      });
      iceCandidateQueueRef.current = [];

    } catch (err) {
      console.error("❌ Answer error:", err);
    }
  }, []);

  // ===============================
  // 📥 HANDLE ICE
  // ===============================
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (err) {
      console.error("❌ ICE error:", err);
    }
  }, []);

  // ===============================
  // 🎛 Toggle Tracks
  // ===============================
  useEffect(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach(t => t.enabled = isVideoEnabled);
    localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);

  }, [isVideoEnabled, isAudioEnabled]);

  // ===============================
  // 🧹 Cleanup
  // ===============================
  const cleanup = useCallback(() => {
    console.log("🧹 Cleanup");

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    remoteStreamRef.current = new MediaStream();
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