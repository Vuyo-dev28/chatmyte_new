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
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
      console.log("[WebRTC] ICE state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.warn("[WebRTC] ICE connection failed, consider restarting or skipping");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);
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
      const videoSender = pc.getSenders().find(s => s.track?.kind === "video");
      if (videoSender) {
        const params = videoSender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps for HD quality
        params.encodings[0].maxFramerate = 30;
        videoSender.setParameters(params).then(() => {
          console.log("🚀 [WebRTC] Video bitrate optimized to 2.5Mbps");
        }).catch(e => console.error("❌ [WebRTC] Error setting bitrate:", e));
      }
    }

    return pc;

  }, [initializeMedia, socket, remoteVideoRef]);

  // Helper to inject bitrate into SDP
  const enhanceSDP = (sdp: string) => {
    return sdp.replace(
      /a=fmtp:\d+ .*\r\n/g,
      match => match + "x-google-start-bitrate=2000\r\n"
    );
  };

  // ===============================
  // 3️⃣ Create Offer
  // ===============================
  const createOffer = useCallback(async (targetId: string) => {
    const pc = await initializePeerConnection();

    try {
      if (pc.signalingState === "closed") return;

      makingOfferRef.current = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      if (pc.signalingState !== "stable") return;

      // 🔥 Enhance offer SDP
      if (offer.sdp) {
        offer.sdp = enhanceSDP(offer.sdp);
      }

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

      if (pc.signalingState === "closed") return;

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

      // 🔥 Enhance answer SDP
      if (answer.sdp) {
        answer.sdp = enhanceSDP(answer.sdp);
      }

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

      if (pc.signalingState === "closed") return;

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
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log("⏳ Queueing ICE candidate (remote description not set or incomplete)");
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