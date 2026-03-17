import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCProps {
  socket: Socket;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80?transport=udp",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:443?transport=tcp"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

export const useWebRTC = ({
  socket,
  localVideoRef,
  remoteVideoRef,
  isVideoEnabled,
  isAudioEnabled
}: UseWebRTCProps) => {

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerIdRef = useRef<string | null>(null);

  // ===============================
  // 1️⃣ Initialize Media (once)
  // ===============================
  const initializeMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => { });
      }

      return stream;
    } catch (err) {
      console.error("❌ Media error:", err);
      return null;
    }
  }, [localVideoRef]);

  // ===============================
  // 2️⃣ Cleanup previous connection
  // ===============================
  const cleanupConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidateQueueRef.current = [];
    partnerIdRef.current = null;

    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, [remoteVideoRef]);

  // ===============================
  // 3️⃣ Initialize PeerConnection
  // ===============================
  const initializePeerConnection = useCallback(async (newPartnerId: string) => {
    cleanupConnection();
    partnerIdRef.current = newPartnerId;

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // Add local tracks
    const stream = await initializeMedia();
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      // Optional: optimize video sender
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = 2_500_000;
        params.encodings[0].maxFramerate = 30;
        sender.setParameters(params).catch(console.warn);
      }
    }

    // ICE candidates
    pc.onicecandidate = e => {
      if (e.candidate && partnerIdRef.current) {
        socket.emit("ice-candidate", { candidate: e.candidate, targetId: partnerIdRef.current });
      }
    };

    // Remote tracks
    pc.ontrack = e => {
      const remoteStream = e.streams[0];
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => { });
      }
    };

    return pc;
  }, [cleanupConnection, initializeMedia, remoteVideoRef, socket]);

  // ===============================
  // 4️⃣ Create Offer
  // ===============================
  const createOffer = useCallback(async (targetId: string) => {
    const pc = await initializePeerConnection(targetId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    socket.emit("offer", { offer, targetId });
  }, [initializePeerConnection, socket]);

  // ===============================
  // 5️⃣ Handle Offer
  // ===============================
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    if (partnerIdRef.current !== from) {
      cleanupConnection();
      partnerIdRef.current = from;
    }

    const pc = await initializePeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Process queued ICE candidates
    iceCandidateQueueRef.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn));
    iceCandidateQueueRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { answer, targetId: from });
  }, [initializePeerConnection, cleanupConnection, socket]);

  // ===============================
  // 6️⃣ Handle Answer
  // ===============================
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));

    iceCandidateQueueRef.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.warn));
    iceCandidateQueueRef.current = [];
  }, []);

  // ===============================
  // 7️⃣ Handle ICE Candidate
  // ===============================
  const handleIceCandidate = useCallback((candidate: RTCIceCandidateInit, from: string) => {
    if (partnerIdRef.current !== from) return; // Ignore old connections

    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) {
      iceCandidateQueueRef.current.push(candidate);
    } else {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
    }
  }, []);

  // ===============================
  // 8️⃣ Toggle tracks
  // ===============================
  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => t.enabled = isVideoEnabled);
    localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);
  }, [isVideoEnabled, isAudioEnabled]);

  // ===============================
  // 9️⃣ Cleanup all
  // ===============================
  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, [localVideoRef]);

  const cleanup = useCallback(() => {
    cleanupConnection();
    stopMedia();
  }, [cleanupConnection, stopMedia]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
    stopMedia,
    cleanupConnection
  };
};