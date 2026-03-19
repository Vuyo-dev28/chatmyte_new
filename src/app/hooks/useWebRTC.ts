import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";

interface UseWebRTCProps {
  socket: Socket;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

interface MatchInfo {
  partnerId: string;
  matchId: string;
  role: "caller" | "callee";
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD"
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD"
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD"
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);

  const matchRef = useRef<MatchInfo | null>(null);

  // ================= MEDIA =================
  const initMedia = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch(() => { });
    }

    return stream;
  }, [localVideoRef]);

  // ================= PC =================
  const createPC = useCallback(async () => {
    if (pcRef.current) pcRef.current.close();

    const pc = new RTCPeerConnection(iceServers);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (!e.candidate || !matchRef.current) return;

      socket.emit("ice-candidate", {
        candidate: e.candidate,
        targetId: matchRef.current.partnerId,
        matchId: matchRef.current.matchId
      });
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (remoteVideoRef.current) {
        const video = remoteVideoRef.current;
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.onloadedmetadata = () => video.play().catch(() => { });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("STATE:", pc.connectionState);
    };

    const stream = await initMedia();
    stream?.getTracks().forEach(track => pc.addTrack(track, stream));

    return pc;
  }, [socket, initMedia, remoteVideoRef]);

  // ================= OFFER =================
  const createOffer = useCallback(async () => {
    if (!matchRef.current || matchRef.current.role !== "caller") return;

    const pc = await createPC();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
      offer,
      targetId: matchRef.current.partnerId,
      matchId: matchRef.current.matchId
    });
  }, [createPC, socket]);

  // ================= HANDLE OFFER =================
  const handleOffer = useCallback(async (offer: any, from: string, matchId: string) => {
    if (!matchRef.current || matchRef.current.matchId !== matchId) return;

    const pc = await createPC();

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", {
      answer,
      targetId: from,
      matchId
    });
  }, [createPC, socket]);

  // ================= HANDLE ANSWER =================
  const handleAnswer = useCallback(async (answer: any, matchId: string) => {
    if (!pcRef.current || !matchRef.current || matchRef.current.matchId !== matchId) return;

    await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

    iceQueue.current.forEach(c => pcRef.current?.addIceCandidate(new RTCIceCandidate(c)));
    iceQueue.current = [];
  }, []);

  // ================= ICE =================
  const handleICE = useCallback(async (candidate: any, matchId: string) => {
    if (!pcRef.current || !matchRef.current || matchRef.current.matchId !== matchId) return;

    if (pcRef.current.remoteDescription) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      iceQueue.current.push(candidate);
    }
  }, []);

  // ================= MATCH EVENT =================
  useEffect(() => {
    socket.on("paired", async (data: MatchInfo) => {
      console.log("PAIRED:", data);

      cleanup();
      matchRef.current = data;

      if (data.role === "caller") {
        await createOffer();
      }
    });

    socket.on("offer", ({ offer, from, matchId }) => handleOffer(offer, from, matchId));
    socket.on("answer", ({ answer, matchId }) => handleAnswer(answer, matchId));
    socket.on("ice-candidate", ({ candidate, matchId }) => handleICE(candidate, matchId));

    return () => {
      socket.off("paired");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [socket, createOffer, handleOffer, handleAnswer, handleICE]);

  // ================= TOGGLE =================
  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = isVideoEnabled);
    localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = isAudioEnabled);
  }, [isVideoEnabled, isAudioEnabled]);

  // ================= CLEANUP =================
  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    iceQueue.current = [];
  }, [remoteVideoRef]);

  return {
    cleanup
  };
};
