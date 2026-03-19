import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCProps {
  socket: Socket;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  partnerId: string | null;
  matchId: string | null;
  role: 'caller' | 'callee' | null;
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    {
      urls: [
        "turn:openrelay.metered.ca:80?transport=udp",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:443?transport=tcp"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ],
  iceCandidatePoolSize: 10
};

export const useWebRTC = ({
  socket,
  localVideoRef,
  remoteVideoRef,
  isVideoEnabled,
  isAudioEnabled,
  partnerId,
  matchId,
  role
}: UseWebRTCProps) => {

  const partnerIdRef = useRef<string | null>(partnerId);
  const matchIdRef = useRef<string | null>(matchId);
  const roleRef = useRef<'caller' | 'callee' | null>(role);

  useEffect(() => {
    partnerIdRef.current = partnerId;
    matchIdRef.current = matchId;
    roleRef.current = role;
  }, [partnerId, matchId, role]);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false); // This will be removed or made redundant

  // ===============================
  // 1️⃣ Initialize Media (ONLY ONCE)
  // ===============================
  const initializeMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      console.log("🎥 Requesting media...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { min: 1280, ideal: 1920, max: 1920 },
          height: { min: 720, ideal: 1080, max: 1080 },
          frameRate: { ideal: 30 }
        },
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
      closePeerConnection();
    }

    console.log("🔗 Creating PeerConnection...");

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`📡 [WebRTC] Generated ICE candidate: ${event.candidate.candidate.substring(0, 40)}...`);
        if (partnerIdRef.current && matchIdRef.current) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            targetId: partnerIdRef.current,
            matchId: matchIdRef.current
          });
        }
      } else {
        console.log("📡 [WebRTC] ICE candidate gathering complete");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state (${matchIdRef.current}):`, pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.warn("[WebRTC] ICE connection failed for match:", matchIdRef.current);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state (${matchIdRef.current}):`, pc.connectionState);
    };

    // Remote Track
    pc.ontrack = (event) => {
      console.log("📹 Remote track received");

      const remoteStream = event.streams[0];
      if (remoteVideoRef.current) {
        // Force reset the video element to a clean state
        remoteVideoRef.current.srcObject = remoteStream;

        remoteVideoRef.current.play().catch((err: any) => {
          if (err.name !== 'AbortError') {
            console.warn("[WebRTC] Error playing remote video:", err);
          }
        });
      }
    };

    // Add local tracks BEFORE offer
    const stream = await initializeMedia();

    // Safety check: has the connection been closed while waiting for media?
    if (pc.signalingState === "closed") {
      console.warn("⚠️ [WebRTC] PeerConnection closed before tracks could be added");
      return pc;
    }

    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          if (pc.signalingState !== "closed") {
            pc.addTrack(track, stream);
          }
        } catch (e) {
          console.error("❌ [WebRTC] Error adding track:", e);
        }
      });
      console.log("✅ Local tracks added");

      // 🔥 Optimize bitrate for the video sender
      // After adding your video track
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];

        // 🔥 Force HD Quality
        params.degradationPreference = 'maintain-resolution';
        params.encodings[0].maxBitrate = 4_000_000; // 4 Mbps
        params.encodings[0].maxFramerate = 30;

        sender.setParameters(params).catch((err: any) => {
          console.warn("[WebRTC] Failed to set sender parameters:", err);
        });
        console.log("🚀 [WebRTC] Quality boosted: 1080p @ 4Mbps");
      }
    }

    return pc;

  }, [initializeMedia, socket, remoteVideoRef, matchIdRef]);

  // No manual SDP patching needed; using sender parameters for bitrate

  // ===============================
  // 3️⃣ Create Offer
  // ===============================
  const createOffer = useCallback(async (targetId: string, currentMatchId: string) => {
    if (roleRef.current !== 'caller') {
      console.warn("⚠️ [WebRTC] Not the caller. Skipping offer creation.");
      return;
    }

    console.log(`📤 [WebRTC] Creating offer for match: ${currentMatchId}`);
    partnerIdRef.current = targetId;
    matchIdRef.current = currentMatchId;
    
    const pc = await initializePeerConnection();

    try {
      if (pc.signalingState === "closed") return;

      makingOfferRef.current = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      if (pc.signalingState !== "stable") return;

      await pc.setLocalDescription(offer);

      socket.emit("offer", {
        offer,
        targetId: targetId,
        matchId: currentMatchId
      });
    } catch (err) {
      console.error("❌ Offer creation error:", err);
    } finally {
      makingOfferRef.current = false;
    }

  }, [initializePeerConnection, socket, roleRef]);

  // ===============================
  // 4️⃣ Handle Offer
  // ===============================
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string, incomingMatchId: string) => {
    // 🛡️ Strict Session Validation
    if (matchIdRef.current && matchIdRef.current !== incomingMatchId) {
      console.warn(`⚠️ [Signaling] Ignoring offer from stale match ${incomingMatchId} (Active: ${matchIdRef.current})`);
      return;
    }

    // 🛡️ Strict Omegle Logic: Ignore offers from anyone except current partner
    if (partnerIdRef.current && partnerIdRef.current !== from) {
      console.warn("⚠️ [Signaling] Ignoring offer from old partner:", from);
      return;
    }

    try {
      partnerIdRef.current = from; // Atomic update
      matchIdRef.current = incomingMatchId; // Atomic update
      const pc = await initializePeerConnection();
      console.log(`📥 [Signaling] Handling offer from ${from} for match ${incomingMatchId}. State: ${pc.signalingState}`);
      
      // With server-assigned roles, we don't need polite/impolite logic for collision.
      // The callee simply accepts the offer.
      if (pc.signalingState === "closed") return;

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log(`📥 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
        iceCandidateQueueRef.current.forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e: any) => {
            if (e.name !== 'InvalidStateError') console.error("❌ ICE error:", e);
          });
        });
        iceCandidateQueueRef.current = [];
      }

      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);

      socket.emit("answer", {
        answer,
        targetId: from,
        matchId: incomingMatchId
      });
    } catch (err) {
      console.error("❌ Offer handling error:", err);
    }

  }, [initializePeerConnection, socket]);

  // ===============================
  // 5️⃣ Handle Answer
  // ===============================
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, from: string, incomingMatchId: string) => {
    // 🛡️ Strict Session Validation
    if (matchIdRef.current && matchIdRef.current !== incomingMatchId) {
      console.warn(`⚠️ [Signaling] Ignoring answer from stale match ${incomingMatchId} (Active: ${matchIdRef.current})`);
      return;
    }

    // 🛡️ Strict Omegle Logic: Ignore answers from unknown partners
    if (from && partnerIdRef.current && partnerIdRef.current !== from) {
      console.warn("⚠️ [Signaling] Ignoring answer from old partner:", from);
      return;
    }

    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      console.log(`📥 Handling answer for match: ${incomingMatchId}`);

      if (pc.signalingState === "closed") return;

      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Process queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log(`📥 Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
        iceCandidateQueueRef.current.forEach(candidate => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e: any) => {
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
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, from: string, incomingMatchId: string) => {
    // 🛡️ Strict Session Validation
    if (matchIdRef.current && matchIdRef.current !== incomingMatchId) {
      console.warn(`⚠️ [Signaling] Ignoring ICE candidate from stale match ${incomingMatchId} (Active: ${matchIdRef.current})`);
      return;
    }

    // 🛡️ Strict Omegle Logic: Ignore ICE from unknown partners
    if (from && partnerIdRef.current && partnerIdRef.current !== from) {
      console.warn("⚠️ [Signaling] Ignoring ICE candidate from old partner:", from);
      return;
    }

    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log("⏳ Queueing ICE candidate (remote description not set)");
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (error) {
      // Ignore errors if the candidate is null or empty, which can happen at the end of gathering
      if (candidate.candidate) {
        console.error("❌ ICE error:", error);
      }
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
  const closePeerConnection = useCallback(() => {
    console.log("🔗 [WebRTC] Aggressive teardown: Closing PeerConnection & Resetting state...");
    const pc = peerConnectionRef.current;

    if (pc) {
      // 1. Strip all listeners instantly to stop incoming events
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      pc.onsignalingstatechange = null;

      // 2. Remove all tracks to stop outbound data instantly
      pc.getSenders().forEach(s => {
        try {
          pc.removeTrack(s);
        } catch (e) { }
      });

      // 3. Clear remote video tracks to avoid "ghosting"
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        try {
          const stream = remoteVideoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
        } catch (e) { }
        remoteVideoRef.current.srcObject = null;
      }

      // 4. Final close
      pc.close();
      peerConnectionRef.current = null;
    }

    // 5. Reset internal signaling flags
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    iceCandidateQueueRef.current = [];
    // 🛡️ DO NOT null out partnerIdRef here, as it may be used by a followed initialization
  }, [remoteVideoRef]);

  const stopMedia = useCallback(() => {
    console.log("🎥 Stopping all media tracks...");
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [localVideoRef]);

  const cleanup = useCallback(() => {
    console.log("🧹 Full WebRTC cleanup (PC + Media)...");
    closePeerConnection();
    stopMedia();
  }, [closePeerConnection, stopMedia]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
    closePeerConnection,
    stopMedia
  };
};