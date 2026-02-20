import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { useWebRTC } from "../hooks/useWebRTC";

interface ChatInterfaceProps {
  socket: Socket;
}

export default function ChatInterface({ socket }: ChatInterfaceProps) {
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
    socket.emit("start-search");

    socket.on("match-found", async (data: { partnerId: string }) => {
      setPartnerId(data.partnerId);
      setIsSearching(false);

      // deterministic offer creator
      if (socket.id && socket.id < data.partnerId) {
        await createOffer(data.partnerId);
      }
    });

    socket.on("offer", async ({ offer, from }) => {
      await handleOffer(offer, from);
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

    return () => {
      socket.off("match-found");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("partner-disconnected");
    };
  }, [socket, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  // ===============================
  // 🔄 Skip Chat
  // ===============================
  const handleSkip = useCallback(() => {
    cleanup();
    setPartnerId(null);
    setIsSearching(true);
    socket.emit("skip");
    socket.emit("start-search");
  }, [cleanup, socket]);

  // ===============================
  // ❌ Exit Chat
  // ===============================
  const handleExit = useCallback(() => {
    cleanup();
    socket.emit("leave-chat");
    setPartnerId(null);
    setIsSearching(true);
  }, [cleanup, socket]);

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