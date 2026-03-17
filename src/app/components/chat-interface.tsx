import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAuth } from "../components/auth-context";

interface ChatInterfaceProps {
  socket: Socket;
  onExit: () => void;
}

export function ChatInterface({ socket, onExit }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isUserViewMain, setIsUserViewMain] = useState(false);

  // ✅ ONE stable video ref per stream
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup
  } = useWebRTC({
    socket,
    localVideoRef,
    remoteVideoRef,
    isVideoEnabled,
    isAudioEnabled,
    partnerId
  });

  // ===============================
  // 🎯 Match Handling
  // ===============================
  useEffect(() => {
    if (!socket || !user) return;
    
    // Server expects "join-queue" with userData
    socket.emit("join-queue", {
      userId: user.id,
      username: user.username,
      gender: user.gender,
      tier: user.tier,
      preferredGender: 'all' // Default preference
    });

    // Server emits "matched" when a match is found
    socket.on("matched", async (data: { partnerId: string }) => {
      console.log("🎯 Match found:", data.partnerId);
      setPartnerId(data.partnerId);
      setIsSearching(false);

      // deterministic offer creator (lexicographical order)
      if (socket.id && socket.id < data.partnerId) {
        await createOffer(data.partnerId);
      }
    });

    socket.on("offer", async ({ offer, fromId }) => {
      await handleOffer(offer, fromId);
    });

    socket.on("answer", async ({ answer }) => {
      await handleAnswer(answer);
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      await handleIceCandidate(candidate);
    });

    socket.on("partner-disconnected", () => {
      handleSkip();
    });

    socket.on("partner-skipped", () => {
      handleSkip();
    });

    return () => {
      socket.off("matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("partner-disconnected");
      socket.off("partner-skipped");
    };
  }, [socket, user, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  // ===============================
  // 🔄 Skip Chat
  // ===============================
  const handleSkip = useCallback(() => {
    cleanup();
    setPartnerId(null);
    setIsSearching(true);
    socket.emit("skip");
    // socket.emit("start-search"); // Server "skip" already re-adds partner to queue, but we need to re-join
    socket.emit("join-queue", {
      userId: user?.id,
      username: user?.username,
      gender: user?.gender,
      tier: user?.tier,
      preferredGender: 'all'
    });
  }, [cleanup, socket, user]);

  // ===============================
  // ❌ Exit Chat
  // ===============================
  const handleExit = useCallback(() => {
    cleanup();
    socket.emit("leave-queue");
    setPartnerId(null);
    setIsSearching(true);
    onExit();
  }, [cleanup, socket, onExit]);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center">

      {/* ===============================
          🔍 Searching Overlay
      =============================== */}
      {isSearching && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50 text-white text-xl">
          Searching for partner...
        </div>
      )}

      {/* ===============================
          🎥 Remote Video (always mounted)
      =============================== */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute ${
          isUserViewMain ? "w-48 h-48 bottom-4 right-4 rounded-xl" : "w-full h-full"
        } object-cover bg-black`}
      />

      {/* ===============================
          🎥 Local Video (always mounted)
      =============================== */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className={`absolute ${
          isUserViewMain ? "w-full h-full" : "w-48 h-48 bottom-4 right-4 rounded-xl"
        } object-cover bg-black`}
      />

      {/* ===============================
          🎛 Controls
      =============================== */}
      {!isSearching && (
        <div className="absolute bottom-6 flex gap-4 z-50">

          <button
            onClick={() => setIsVideoEnabled(v => !v)}
            className="px-4 py-2 bg-white rounded-lg"
          >
            {isVideoEnabled ? "Camera Off" : "Camera On"}
          </button>

          <button
            onClick={() => setIsAudioEnabled(a => !a)}
            className="px-4 py-2 bg-white rounded-lg"
          >
            {isAudioEnabled ? "Mute" : "Unmute"}
          </button>

          <button
            onClick={handleSkip}
            className="px-4 py-2 bg-yellow-400 rounded-lg"
          >
            Skip
          </button>

          <button
            onClick={handleExit}
            className="px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Exit
          </button>

          <button
            onClick={() => setIsUserViewMain(v => !v)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Swap View
          </button>
        </div>
      )}
    </div>
  );
}