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
  Maximize2,
  Users,
  ChevronRight,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatInterfaceProps {
  socket: Socket;
  onExit: () => void;
  preferredGender: 'all' | 'male' | 'female' | 'other';
  setPreferredGender: (gender: 'all' | 'male' | 'female' | 'other') => void;
  chatMode: 'video' | 'text';
}

export function ChatInterface({ socket, onExit, preferredGender, setPreferredGender, chatMode }: ChatInterfaceProps) {
  const { user } = useAuth();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isUserViewMain, setIsUserViewMain] = useState(false);
  const [remoteAspectRatio, setRemoteAspectRatio] = useState<'landscape' | 'portrait'>('landscape');
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; age: number } | null>(null);
  const [currentSearchGender, setCurrentSearchGender] = useState(preferredGender);
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'me' | 'partner'; text: string; time: number }[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ ONE stable video ref per stream
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanup,
    closePeerConnection,
    stopMedia
  } = useWebRTC({
    socket,
    localVideoRef,
    remoteVideoRef,
    isVideoEnabled,
    isAudioEnabled,
    partnerId: chatMode === 'video' ? partnerId : null // Only init WebRTC in video mode
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
      age: user.age,
      preferredGender: currentSearchGender,
      chatMode: chatMode
    });
  }, [socket, user, currentSearchGender, chatMode]);

  // ===============================
  // 🔄 Queue Management
  // ===============================
  const handleJoinQueue = useCallback(() => {
    console.log("🔄 [Chat] Joining/Resetting queue...");
    closePeerConnection(); // Keep media, only close peer connection
    setPartnerId(null);
    setPartnerInfo(null);
    setMessages([]); // Clear chat history
    setRemoteAspectRatio('landscape'); // Reset UI state
    setIsSearching(true);
    
    if (user) {
      socket.emit("join-queue", {
        userId: user.id,
        username: user.username,
        gender: user.gender,
        tier: user.tier,
        age: user.age,
        preferredGender: currentSearchGender
      });
    }
  }, [cleanup, socket, user, currentSearchGender]);

  const handleSkip = useCallback(() => {
    console.log("🔄 [Chat] Initiating skip...");
    // Reset gender to user preference when skipping
    setCurrentSearchGender(preferredGender);
    setIsFallbackActive(false);
    socket.emit("skip");
    handleJoinQueue();
  }, [socket, handleJoinQueue, preferredGender]);

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
    socket.on("matched", async (data: { partnerId: string; partnerInfo: { name: string; age: number } }) => {
      console.log(`🎯 [Signaling] Match found: ${data.partnerId}`, data.partnerInfo);
      
      // Safety delay to ensure previous connection teardown is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      setPartnerId(data.partnerId);
      setPartnerInfo({
        name: data.partnerInfo.name || "User",
        age: data.partnerInfo.age || 18
      });
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

    socket.on("answer", async ({ answer, fromId }) => {
      await handleAnswer(answer, fromId);
    });

    socket.on("ice-candidate", async ({ candidate, fromId }) => {
      await handleIceCandidate(candidate, fromId);
    });

    socket.on("partner-disconnected", () => {
      handlePartnerEvent();
    });

    socket.on("partner-skipped", () => {
      handlePartnerEvent();
    });

    socket.on("chat:message", (data: { text: string; senderId: string; timestamp: number }) => {
      setMessages(prev => [...prev, {
        sender: 'partner',
        text: data.text,
        time: data.timestamp
      }]);
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
  // ⏱️ 15s Fallback Logic
  // ===============================
  useEffect(() => {
    if (!isSearching || preferredGender === 'all') {
      setIsFallbackActive(false);
      return;
    }

    const timer = setTimeout(() => {
      console.log("⏱️ [Chat] 15s timeout reached. Falling back to 'all' genders...");
      setIsFallbackActive(true);
      setCurrentSearchGender('all');
    }, 15000);

    return () => clearTimeout(timer);
  }, [isSearching, preferredGender]);

  // Sync internal search gender with global preference when not in fallback
  useEffect(() => {
    if (!isFallbackActive) {
      setCurrentSearchGender(preferredGender);
    }
  }, [preferredGender, isFallbackActive]);
  
  const handleLoadedMetadata = useCallback(() => {
    if (remoteVideoRef.current) {
      const { videoWidth, videoHeight } = remoteVideoRef.current;
      console.log(`📹 Remote video metadata loaded: ${videoWidth}x${videoHeight}`);
      if (videoWidth > 0 && videoHeight > 0) {
        if (videoHeight > videoWidth) {
          setRemoteAspectRatio('portrait');
        } else {
          setRemoteAspectRatio('landscape');
        }
      }
    }
  }, [remoteVideoRef]);

  // Periodic check as a fallback for missing events
  useEffect(() => {
    if (isSearching) return;
    const interval = setInterval(() => {
      handleLoadedMetadata();
    }, 1000);
    return () => clearInterval(interval);
  }, [isSearching, handleLoadedMetadata]);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !partnerId) return;

    socket.emit('chat:message', {
      text: inputText,
      targetId: partnerId
    });

    setMessages(prev => [...prev, {
      sender: 'me',
      text: inputText,
      time: Date.now()
    }]);

    setInputText("");
  };

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
          <div className="flex flex-col items-center gap-2">
            <div className="animate-pulse">
              {partnerId ? "Connecting to partner..." : `Searching for ${currentSearchGender === 'all' ? 'anyone' : currentSearchGender + 's'}...`}
            </div>
            {isFallbackActive && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-yellow-500/80 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20"
              >
                Connecting to anyone available...
              </motion.div>
            )}
          </div>
          {partnerId ? (
            <div className="flex gap-4">
              <button 
                onClick={handleSkip}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm rounded-full transition-colors border border-white/10"
              >
                Take too long? Skip
              </button>
              <button 
                onClick={handleExit}
                className="px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 text-sm rounded-full transition-colors border border-red-500/30"
              >
                Cancel Search
              </button>
            </div>
          ) : (
            <button 
              onClick={handleExit}
              className="mt-4 px-8 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-full transition-all border border-white/10 backdrop-blur-md"
            >
              Cancel & Exit
            </button>
          )}
        </div>
      )}

      {/* ===============================
          🎥 Remote Video (always mounted)
      =============================== */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-950">
        {chatMode === 'video' ? (
          <>
            {/* Blurred Background for Portrait Streams */}
            {remoteAspectRatio === 'portrait' && !isSearching && (
              <video
                ref={(el) => {
                  if (el && remoteVideoRef.current && el.srcObject !== remoteVideoRef.current.srcObject) {
                    el.srcObject = remoteVideoRef.current.srcObject;
                  }
                }}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-40 brightness-50"
              />
            )}
            
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onResize={handleLoadedMetadata}
              className={`absolute inset-0 w-full h-full bg-transparent transition-opacity ${
                isSearching ? "opacity-0 duration-0" : "opacity-100 duration-500"
              } ${remoteAspectRatio === 'portrait' ? 'object-contain' : 'object-cover'}`}
            />
          </>
        ) : (
          /* Text Mode Background */
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex items-center justify-center">
            {!isSearching && (
              <div className="text-zinc-800 text-9xl font-black italic select-none opacity-20 transform -rotate-12">
                CHATMYTE
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===============================
          🏷️ Partner Info Overlay
      =============================== */}
      {!isSearching && partnerInfo && (
        <div className="absolute top-6 left-6 z-40 flex flex-col gap-1">
          <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-white font-medium text-sm sm:text-base">
              {partnerInfo.name}, {partnerInfo.age}
            </span>
          </div>
        </div>
      )}

      {/* ===============================
          🎥 Local Video (mini overlay) - Only in video mode
      =============================== */}
      {chatMode === 'video' && (
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
      )}

      {/* ===============================
          💬 Text Chat UI - Only in text mode
      =============================== */}
      {chatMode === 'text' && !isSearching && (
        <div className="absolute inset-0 flex flex-col pt-24 pb-32 px-6 sm:px-12 max-w-4xl mx-auto z-30">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-4 scrollbar-hide mb-6">
            <div className="text-center text-xs text-zinc-500 font-bold uppercase tracking-widest py-4 border-b border-white/5">
              Secure Text Connection Established
            </div>
            
            {messages.length === 0 && (
              <div className="text-center text-zinc-600 italic py-20 text-sm">
                Say something to start the conversation...
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, x: msg.sender === 'me' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={i}
                className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  msg.sender === 'me' 
                    ? 'bg-yellow-500 text-black font-medium rounded-tr-none shadow-lg shadow-yellow-500/10' 
                    : 'bg-white/10 text-white rounded-tl-none border border-white/5'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-zinc-600 mt-1 px-1">
                  {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity" />
            <div className="relative flex items-center bg-zinc-900 border border-white/10 rounded-2xl p-2 pl-4">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-zinc-600 text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="ml-2 w-10 h-10 rounded-xl bg-yellow-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all font-bold"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

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

            {chatMode === 'video' && (
              <ControlButton 
                onClick={() => setIsUserViewMain(v => !v)}
                icon={<Maximize2 size={20} />}
                label="Swap View"
              />
            )}

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

      {/* ===============================
          🏷️ Gender Filter (Floating)
      =============================== */}
      <AnimatePresence>
        {!isSearching && (
           <motion.div 
             initial={{ x: -20, opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             exit={{ x: -20, opacity: 0 }}
             className="absolute bottom-28 left-6 sm:bottom-auto sm:top-20 sm:left-6 z-40 bg-black/30 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl flex flex-row sm:flex-col gap-1 shadow-2xl transition-all"
           >
             {(['all', 'male', 'female', 'other'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    if (user?.tier !== 'premium' && g !== 'all') {
                      return; // Modal already handled in dashboard or just silent block
                    }
                    setPreferredGender(g);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    preferredGender === g 
                      ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" 
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  } ${user?.tier !== 'premium' && g !== 'all' ? 'opacity-20 cursor-not-allowed' : ''}`}
                  title={g === 'all' ? 'All Genders' : g.charAt(0).toUpperCase() + g.slice(1)}
                >
                  {g === 'all' ? <Users size={18} /> : g.charAt(0).toUpperCase()}
                </button>
             ))}
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