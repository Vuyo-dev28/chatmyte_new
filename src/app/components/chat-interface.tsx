import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { useWebRTC } from "../hooks/useWebRTC";
import { useAuth } from "../components/auth-context";
import { 
  Camera, 
  CameraOff, 
  Mic, 
  MicOff, 
  SkipForward, 
  LogOut, 
  MonitorPlay,
  Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  // 🎯 Matchmaking Initialization
  // ===============================
  useEffect(() => {
    if (!socket || !user) return;
    
    console.log("🚀 [Chat] Emitting join-queue...");
    // Server expects "join-queue" with userData
    socket.emit("join-queue", {
      userId: user.id,
      username: user.username,
      gender: user.gender,
      tier: user.tier,
      preferredGender: 'all' // Default preference
    });
  }, [socket, user]);

  // ===============================
  // 🔄 Queue Management
  // ===============================
  const handleJoinQueue = useCallback(() => {
    console.log("🔄 [Chat] Joining/Resetting queue...");
    cleanup();
    setPartnerId(null);
    setIsSearching(true);
    
    if (user) {
      socket.emit("join-queue", {
        userId: user.id,
        username: user.username,
        gender: user.gender,
        tier: user.tier,
        preferredGender: 'all'
      });
    }
  }, [cleanup, socket, user]);

  const handleSkip = useCallback(() => {
    console.log("🔄 [Chat] Initiating skip...");
    socket.emit("skip");
    handleJoinQueue();
  }, [socket, handleJoinQueue]);

  const handlePartnerEvent = useCallback(() => {
    console.log("🔄 [Chat] Partner left or skipped. Re-joining...");
    handleJoinQueue();
  }, [handleJoinQueue]);

  // ===============================
  // 🎯 Signaling Event Listeners
  // ===============================
  useEffect(() => {
    if (!socket || !user) return;
    
    // Server emits "matched" when a match is found
    socket.on("matched", async (data: { partnerId: string }) => {
      console.log(`🎯 [Signaling] Match found: ${data.partnerId} (Me: ${socket.id})`);
      setPartnerId(data.partnerId);
      setIsSearching(false);

      // deterministic offer creator (lexicographical order)
      if (socket.id && socket.id < data.partnerId) {
        console.log(`📤 [Signaling] I am the offerer (< ${data.partnerId})`);
        await createOffer(data.partnerId);
      } else {
        console.log(`📥 [Signaling] I am the answerer (>= ${data.partnerId})`);
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
      handlePartnerEvent();
    });

    socket.on("partner-skipped", () => {
      handlePartnerEvent();
    });

    return () => {
      socket.off("matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("partner-disconnected");
      socket.off("partner-skipped");
    };
  }, [socket, user, createOffer, handleOffer, handleAnswer, handleIceCandidate, handlePartnerEvent]);

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
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50 text-white text-xl flex-col gap-4">
          <div className="animate-pulse">
            {partnerId ? "Connecting to partner..." : "Searching for partner..."}
          </div>
          {partnerId && (
            <button 
              onClick={handleSkip}
              className="mt-4 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-full transition-colors"
            >
              Take too long? Skip
            </button>
          )}
        </div>
      )}

      {/* ===============================
          🎥 Remote Video (always mounted)
      =============================== */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover bg-neutral-900 transition-opacity duration-700 ${
          isSearching ? "opacity-30" : "opacity-100"
        }`}
      />

      {/* ===============================
          🎥 Local Video (mini overlay)
      =============================== */}
      <div 
        className={`absolute top-6 right-6 z-40 transition-all duration-500 ease-in-out ${
          isUserViewMain ? "w-full h-full !top-0 !right-0 z-0" : "w-44 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
        }`}
      >
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover bg-neutral-800"
        />
        {!isUserViewMain && (
           <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
             <span className="text-white text-[10px] uppercase font-bold tracking-widest px-2 py-1 bg-black/40 rounded backdrop-blur-sm">
               You
             </span>
           </div>
        )}
      </div>

      {/* ===============================
          🎛 Controls (Unified Premium Bar)
      =============================== */}
      <AnimatePresence>
        {!isSearching && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-3 bg-black/30 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl scale-110 sm:scale-100"
          >
            <ControlButton 
              onClick={() => setIsVideoEnabled(v => !v)}
              active={isVideoEnabled}
              icon={isVideoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
              label={isVideoEnabled ? "Camera Off" : "Camera On"}
            />

            <ControlButton 
              onClick={() => setIsAudioEnabled(a => !a)}
              active={isAudioEnabled}
              icon={isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              label={isAudioEnabled ? "Mute" : "Unmute"}
            />

            <div className="w-[1px] h-8 bg-white/10 mx-1" />

            <ControlButton 
              onClick={handleSkip}
              variant="warning"
              icon={<SkipForward size={22} />}
              label="Skip"
            />

            <ControlButton 
              onClick={() => setIsUserViewMain(v => !v)}
              icon={<Maximize2 size={20} />}
              label="Swap View"
            />

            <div className="w-[1px] h-8 bg-white/10 mx-1" />

            <ControlButton 
              onClick={handleExit}
              variant="danger"
              icon={<LogOut size={20} />}
              label="Exit"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===============================
// 🛠 Reusable Premium Component
// ===============================
interface ControlButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
  variant?: 'default' | 'danger' | 'warning';
  label: string;
}

function ControlButton({ onClick, icon, active = true, variant = 'default', label }: ControlButtonProps) {
  const getStyles = () => {
    if (variant === 'danger') return "bg-red-500/80 hover:bg-red-500 text-white";
    if (variant === 'warning') return "bg-amber-500/80 hover:bg-amber-500 text-white";
    if (!active) return "bg-zinc-800/80 text-zinc-400";
    return "bg-white/10 hover:bg-white/20 text-white";
  };

  return (
    <button
      onClick={onClick}
      title={label}
      className={`group relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 backdrop-blur-sm ${getStyles()}`}
    >
      {icon}
      {/* Tooltip on hover */}
      <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </button>
  );
}