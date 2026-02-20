import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './auth-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Video, MessageCircle, SkipForward, LogOut, Crown, Send, VideoOff, Mic, MicOff, RotateCw, X, PhoneOff, Loader2 } from 'lucide-react';
import { PremiumModal } from './premium-modal';
import { SubscriptionManagement } from './subscription-management';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useIsMobile } from './ui/use-mobile';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'stranger';
  timestamp: Date;
}

const mockStrangers = [
  { name: 'Alex', age: 24, gender: 'male' },
  { name: 'Sarah', age: 22, gender: 'female' },
  { name: 'Jordan', age: 27, gender: 'other' },
  { name: 'Sam', age: 25, gender: 'male' },
  { name: 'Emma', age: 23, gender: 'female' },
  { name: 'Riley', age: 26, gender: 'other' },
];

export function ChatInterface() {
  const { user, logout } = useAuth();
  const [mode, setMode] = useState<'video' | 'chat'>('video');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [stranger, setStranger] = useState<typeof mockStrangers[0] | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'other'>('all');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isUserViewMain, setIsUserViewMain] = useState(false); // false = stranger is main, true = user is main
  const [showMessagesInVideo, setShowMessagesInVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMobile = useIsMobile();
  const hideSidebarForMobileVideo = isMobile && mode === 'video' && !!stranger;
  const hideSidebarForDesktopVideo = !isMobile && mode === 'video' && !!stranger;
  const shouldAutoScrollRef = useRef(true);
  const partnerIdRef = useRef<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  
  // Socket connection
  const { socket, isConnected } = useSocket();
  
  // WebRTC - Initialize remote video ref
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // WebRTC
  const { createOffer, handleOffer, handleAnswer, handleIceCandidate } = useWebRTC({
    socket,
    localVideoRef: videoRef,
    remoteVideoRef: remoteVideoRef as React.RefObject<HTMLVideoElement>,
    isVideoEnabled,
    isAudioEnabled,
    partnerId: partnerId
  });

  const scrollToBottom = () => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 150; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  useEffect(() => {
    // Only auto-scroll if user is near the bottom
    if (shouldAutoScrollRef.current && isNearBottom()) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
    scrollToBottom();
      }, 0);
    }
  }, [messages]);

  // Handle scroll events to detect if user is manually scrolling
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      shouldAutoScrollRef.current = isNearBottom();
    }
  };

  // Monitor remote video stream
  useEffect(() => {
    if (remoteVideoRef.current) {
      const video = remoteVideoRef.current;
      const checkStream = () => {
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          const hasVideoTrack = stream.getVideoTracks().length > 0;
          const hasActiveTrack = stream.getVideoTracks().some(track => track.readyState === 'live');
          
          if (hasVideoTrack && hasActiveTrack) {
            setHasRemoteVideo(true);
            console.log('[ChatInterface] Remote video stream detected and active');
          } else {
            setHasRemoteVideo(false);
            console.log('[ChatInterface] Remote video stream not active');
          }
        } else {
          setHasRemoteVideo(false);
        }
      };

      // Check immediately
      checkStream();

      // Check periodically
      const interval = setInterval(checkStream, 1000);

      // Also check on play/pause events
      video.addEventListener('play', checkStream);
      video.addEventListener('pause', checkStream);

      return () => {
        clearInterval(interval);
        video.removeEventListener('play', checkStream);
        video.removeEventListener('pause', checkStream);
      };
    }
  }, [stranger, partnerId]);

  // Note: getUserMedia is now handled by useWebRTC hook
  // This effect ensures the video element displays the stream from useWebRTC
  useEffect(() => {
    // The useWebRTC hook manages the stream, but we need to ensure
    // the video element is properly connected when it becomes available
    if (mode === 'video' && videoRef.current) {
      // Check if video element has a stream but isn't playing
      const video = videoRef.current;
      if (video.srcObject && video.paused) {
        console.log('[ChatInterface] Video has srcObject but is paused, attempting to play');
        video.play()
          .then(() => {
            console.log('[ChatInterface] ✅ Local video started playing');
          })
          .catch(err => {
            console.error('[ChatInterface] ❌ Error playing local video:', err);
          });
      }
    }
  }, [mode, isVideoEnabled, stranger]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('matched', async (data: { partnerId: string; partnerInfo: { name: string; gender: string; age: number } }) => {
      console.log('Matched with partner!', data);
      partnerIdRef.current = data.partnerId;
      setPartnerId(data.partnerId);
      setStranger({
        name: data.partnerInfo.name,
        age: data.partnerInfo.age,
        gender: data.partnerInfo.gender as 'male' | 'female' | 'other'
      });
      setIsConnecting(false);
      
      // Determine who should create the offer (user with lower socket ID)
      // This prevents both users from creating offers simultaneously
      const mySocketId = socket.id;
      const partnerSocketId = data.partnerId;
      const shouldCreateOffer = mySocketId && partnerSocketId && mySocketId < partnerSocketId;
      
      console.log('Socket IDs:', { mine: mySocketId, partner: partnerSocketId, shouldCreateOffer });
      
      // Start WebRTC connection after a short delay to ensure state is updated
      // Ensure we have media tracks before creating offer
      setTimeout(async () => {
        if (shouldCreateOffer && data.partnerId && createOffer) {
          console.log('[ChatInterface] I am the offerer, creating WebRTC offer to', data.partnerId);
          console.log('[ChatInterface] Waiting for media tracks to be ready...');
          
          // Wait a bit more to ensure tracks are added
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          console.log('[ChatInterface] Creating offer now');
          await createOffer(data.partnerId);
        } else {
          console.log('[ChatInterface] I am the answerer, waiting for offer from', data.partnerId);
        }
      }, 500);
    });

    socket.on('waiting', () => {
      setIsConnecting(true);
    });

    socket.on('message', (data: { text: string; sender: string; timestamp: string }) => {
      const newMessage: Message = {
        id: Math.random().toString(36).substr(2, 9),
        text: data.text,
        sender: 'stranger',
        timestamp: new Date(data.timestamp)
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socket.on('offer', async (data: { offer: RTCSessionDescriptionInit; fromId: string }) => {
      console.log('[ChatInterface] 📨 Received offer from', data.fromId);
      console.log('[ChatInterface] Offer type:', data.offer.type);
      console.log('[ChatInterface] Offer SDP (first 200 chars):', data.offer.sdp?.substring(0, 200));
      await handleOffer(data.offer, data.fromId);
    });

    socket.on('answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      console.log('[ChatInterface] 📨 Received answer');
      console.log('[ChatInterface] Answer type:', data.answer.type);
      console.log('[ChatInterface] Answer SDP (first 200 chars):', data.answer.sdp?.substring(0, 200));
      await handleAnswer(data.answer);
    });

    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      console.log('[ChatInterface] 🧊 Received ICE candidate');
      console.log('[ChatInterface] Candidate:', data.candidate.candidate?.substring(0, 100));
      await handleIceCandidate(data.candidate);
    });

    socket.on('partner-skipped', () => {
      setStranger(null);
      partnerIdRef.current = null;
      setPartnerId(null);
      setMessages([]);
      setHasRemoteVideo(false);
      // Automatically start searching for a new connection
      setIsConnecting(true);
      // The server will automatically put us back in queue and find a match
      // We just need to wait for the 'matched' or 'waiting' event
    });

    socket.on('partner-disconnected', () => {
      setStranger(null);
      partnerIdRef.current = null;
      setPartnerId(null);
      setMessages([]);
      setHasRemoteVideo(false);
      // Automatically start searching for a new connection
      setIsConnecting(true);
      // The server will automatically put us back in queue and find a match
      // We just need to wait for the 'matched' or 'waiting' event
    });

    socket.on('skipped', () => {
      setStranger(null);
      partnerIdRef.current = null;
      setPartnerId(null);
      setIsConnecting(false);
      setMessages([]);
      setHasRemoteVideo(false);
    });

    return () => {
      socket.off('matched');
      socket.off('waiting');
      socket.off('message');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('partner-skipped');
      socket.off('partner-disconnected');
      socket.off('skipped');
    };
  }, [socket, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  const findStranger = () => {
    if (!socket || !user) {
      console.log('Cannot find stranger: socket or user missing', { socket: !!socket, user: !!user });
      return;
    }
    
    console.log('Finding stranger...', { socketId: socket.id, user: user.username });
    
    setIsConnecting(true);
    setMessages([]);
    setStranger(null);
    partnerIdRef.current = null;
    setPartnerId(null);
    
    // Check premium requirement for gender filter
    if (genderFilter !== 'all' && user.tier !== 'premium') {
          setIsPremiumModalOpen(true);
          setIsConnecting(false);
          return;
    }
    
    // Join queue
    socket.emit('join-queue', {
      userId: user.id || user.username || 'unknown',
      username: user.username || 'User',
      gender: user.gender || 'other',
      preferredGender: genderFilter,
      tier: user.tier || 'free',
      age: 25 // You can add age to user profile later
    });
  };

  const handleCancelConnecting = () => {
    if (!socket) return;
    
    // Leave the queue
    socket.emit('leave-queue');
    
    // Reset state
    setIsConnecting(false);
    setStranger(null);
    partnerIdRef.current = null;
    setPartnerId(null);
    setMessages([]);
  };

  const addStrangerMessage = (text: string) => {
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      sender: 'stranger',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !stranger || !socket || !partnerIdRef.current) return;

    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    
    // Send message via socket
    socket.emit('message', {
      text: inputMessage
    });
    
    setInputMessage('');
  };

  const handleSkip = () => {
    if (socket) {
      socket.emit('skip');
    }
    setMessages([]);
    setStranger(null);
    partnerIdRef.current = null;
    setPartnerId(null);
    setIsConnecting(false);
    // Immediately find new person
    setTimeout(() => {
      findStranger();
    }, 100);
  };

  const handleExitChat = () => {
    // Stop video stream
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Notify server to remove from queue and disconnect partner
    if (socket) {
      // If we have a partner, notify them we're leaving
      if (partnerId) {
        socket.emit('skip'); // This will trigger partner-skipped for the other user
      } else {
        // Just remove from queue
        socket.emit('leave-queue');
      }
    }
    
    // Clear connection state
    setStranger(null);
    setMessages([]);
    setIsConnecting(false);
    setIsUserViewMain(false);
    partnerIdRef.current = null;
    setPartnerId(null);
  };

  const handleGenderFilterChange = (value: string) => {
    if (value !== 'all' && user?.tier !== 'premium') {
      setIsPremiumModalOpen(true);
      return;
    }
    setGenderFilter(value as 'all' | 'male' | 'female' | 'other');
  };

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 border-b border-yellow-600/30 p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Video className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl text-yellow-400 truncate">ChatMyte</h1>
              <p className="text-xs text-yellow-200/60 truncate">
                {user?.username} 
                {user?.tier === 'premium' && (
                  <span className="ml-2 inline-flex items-center gap-1 text-yellow-400">
                    <Crown className="w-3 h-3" />
                    <span className="hidden sm:inline">Premium</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {user?.tier === 'free' && (
              <Button
                onClick={() => setIsPremiumModalOpen(true)}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black text-xs sm:text-sm px-2 sm:px-4"
                size="sm"
              >
                <Crown className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Upgrade</span>
              </Button>
            )}
            <Button
              onClick={logout}
              variant="outline"
              className="border-yellow-600/50 text-yellow-200 hover:bg-yellow-900/20 p-2 sm:p-2"
              size="sm"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Controls Sidebar */}
        {!hideSidebarForMobileVideo && !hideSidebarForDesktopVideo && (
        <div className="lg:w-64 bg-gradient-to-br from-yellow-900/10 to-yellow-800/5 border-b lg:border-b-0 lg:border-r border-yellow-600/20 p-2 sm:p-3 lg:p-4 space-y-2 sm:space-y-3 lg:space-y-4 overflow-y-auto">
          <div>
            <h3 className="text-yellow-400 mb-2 sm:mb-2 lg:mb-3 text-sm sm:text-sm lg:text-base">Connection Mode</h3>
            <div className="flex gap-2 sm:gap-2">
              <Button
                onClick={() => setMode('video')}
                className={`flex-1 text-sm sm:text-sm h-10 sm:h-10 lg:h-11 ${mode === 'video' 
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black' 
                  : 'bg-yellow-900/20 text-yellow-200 hover:bg-yellow-900/30'}`}
                size="sm"
              >
                <Video className="w-4 h-4 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Video</span>
              </Button>
              <Button
                onClick={() => setMode('chat')}
                className={`flex-1 text-sm sm:text-sm h-10 sm:h-10 lg:h-11 ${mode === 'chat' 
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black' 
                  : 'bg-yellow-900/20 text-yellow-200 hover:bg-yellow-900/30'}`}
                size="sm"
              >
                <MessageCircle className="w-4 h-4 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
            </div>
          </div>

          <div>
            <label className="text-yellow-400 mb-2 sm:mb-2 lg:mb-3 block flex items-center gap-2 sm:gap-2 text-sm sm:text-sm lg:text-base">
              Gender Filter
              {user?.tier !== 'premium' && (
                <Crown className="w-4 h-4 sm:w-4 sm:h-4 text-yellow-500" />
              )}
            </label>
            <Select value={genderFilter} onValueChange={handleGenderFilterChange}>
              <SelectTrigger className="bg-black/50 border-yellow-600/30 text-yellow-200 text-sm sm:text-sm h-10 sm:h-9 lg:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-yellow-600/50">
                <SelectItem value="all" className="text-yellow-200">All Genders</SelectItem>
                <SelectItem value="male" className="text-yellow-200">Male Only</SelectItem>
                <SelectItem value="female" className="text-yellow-200">Female Only</SelectItem>
                <SelectItem value="other" className="text-yellow-200">Other</SelectItem>
              </SelectContent>
            </Select>
            {genderFilter !== 'all' && user?.tier !== 'premium' && (
              <p className="text-xs text-yellow-500/70 mt-1 sm:mt-1.5 lg:mt-2">Premium feature</p>
            )}
          </div>

          {/* Subscription Management */}
          <SubscriptionManagement />

          <div className="space-y-1.5 sm:space-y-2">
            {!stranger ? (
              <>
                <Button
                  onClick={findStranger}
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black text-sm sm:text-sm lg:text-base h-11 sm:h-10 lg:h-11"
                >
                  {isConnecting ? 'Connecting...' : 'Start Random Chat'}
                </Button>
                {isConnecting && (
                  <Button
                    onClick={handleCancelConnecting}
                    variant="outline"
                    className="w-full border-red-600/60 bg-red-900/20 text-red-300 hover:bg-red-900/30 text-sm sm:text-sm lg:text-base h-10 sm:h-9 lg:h-10"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </>
            ) : (
              <>
              <Button
                onClick={handleSkip}
                  className="w-full bg-yellow-900/30 hover:bg-yellow-900/40 text-yellow-200 text-xs sm:text-sm lg:text-base h-9 sm:h-10 lg:h-11"
              >
                  <SkipForward className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                Next Person
              </Button>
                <Button
                  onClick={handleExitChat}
                  className="w-full bg-red-900/30 hover:bg-red-900/40 text-red-200 text-xs sm:text-sm lg:text-base h-9 sm:h-10 lg:h-11"
                >
                  <PhoneOff className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Exit Chat
                </Button>
              </>
            )}
          </div>

          {stranger && (
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-2 sm:p-3 lg:p-4">
              <p className="text-yellow-400 mb-0.5 sm:mb-1 text-xs sm:text-sm">Connected to:</p>
              <p className="text-yellow-200 text-xs sm:text-sm lg:text-base">{stranger.name}, {stranger.age}</p>
              <p className="text-yellow-200/60 text-xs sm:text-sm capitalize">{stranger.gender}</p>
            </div>
          )}

          {mode === 'video' && stranger && (
            <div className="space-y-1.5 sm:space-y-2">
              <Button
                onClick={() => setIsUserViewMain(!isUserViewMain)}
                className="w-full bg-yellow-900/30 hover:bg-yellow-900/40 text-yellow-200 text-xs sm:text-sm lg:text-base h-9 sm:h-10 lg:h-11"
                size="sm"
              >
                <RotateCw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Switch View</span>
              </Button>
              <Button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`w-full text-xs sm:text-sm lg:text-base h-9 sm:h-10 lg:h-11 ${isVideoEnabled 
                  ? 'bg-yellow-900/30 text-yellow-200' 
                  : 'bg-red-900/30 text-red-200'}`}
                size="sm"
              >
                {isVideoEnabled ? <Video className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" /> : <VideoOff className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />}
                <span className="hidden sm:inline">{isVideoEnabled ? 'Camera On' : 'Camera Off'}</span>
              </Button>
              <Button
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`w-full text-xs sm:text-sm lg:text-base h-9 sm:h-10 lg:h-11 ${isAudioEnabled 
                  ? 'bg-yellow-900/30 text-yellow-200' 
                  : 'bg-red-900/30 text-red-200'}`}
                size="sm"
              >
                {isAudioEnabled ? <Mic className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" /> : <MicOff className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />}
                <span className="hidden sm:inline">{isAudioEnabled ? 'Mic On' : 'Mic Off'}</span>
              </Button>
            </div>
          )}
        </div>
        )}

        {/* Chat/Video Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {!stranger ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="w-24 h-24 sm:w-24 sm:h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
                  <Video className="w-12 h-12 sm:w-12 sm:h-12 text-black" />
                </div>
                <h2 className="text-2xl sm:text-2xl text-yellow-400 mb-2">Ready to Connect?</h2>
                <p className="text-base sm:text-base text-yellow-200/70 mb-6">Click "Start Random Chat" to meet someone new</p>
              </div>
            </div>
          ) : mode === 'video' ? (
            <div className="flex-1 bg-black relative min-h-0">
              {isMobile ? (
                <>
                  {/* Mobile: full-screen stranger + PiP self view */}
                  <div className="absolute inset-0">
                    {isConnecting || !stranger ? (
                      /* Connecting overlay - shows while searching for new person */
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 to-black flex items-center justify-center">
                        <div className="text-center z-10 px-6">
                          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Loader2 className="w-14 h-14 text-black animate-spin" strokeWidth={2.5} />
                          </div>
                          <h2 className="text-2xl text-yellow-400 mb-2">Connecting...</h2>
                          <p className="text-base text-yellow-200/70 mb-4">Finding someone new</p>
                          <Button
                            onClick={handleCancelConnecting}
                            variant="outline"
                            className="border-red-600/60 bg-red-900/20 text-red-300 hover:bg-red-900/30"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Main view (swappable) */}
                        {isUserViewMain ? (
                          /* User is main view */
                          <div 
                            className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 to-black overflow-hidden cursor-pointer transition-all duration-300 ease-in-out animate-in fade-in zoom-in"
                            onClick={() => setIsUserViewMain(false)}
                          >
                            {isVideoEnabled ? (
                              <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover transition-transform duration-300 ease-in-out"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-black">
                                <div className="text-center z-10">
                                  <VideoOff className="w-16 h-16 text-yellow-500/50 mx-auto mb-4" />
                                  <p className="text-yellow-200/70 text-lg">Camera Off</p>
                                </div>
                              </div>
                            )}
                            <div className="absolute top-3 left-3 bg-black/70 px-3 py-1 rounded-full border border-yellow-600/30">
                              <p className="text-yellow-400 text-xs">You</p>
                            </div>
                          </div>
                        ) : (
                          /* Stranger is main view */
                          <div 
                            className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 to-black overflow-hidden cursor-pointer transition-all duration-300 ease-in-out animate-in fade-in zoom-in"
                            onClick={() => setIsUserViewMain(true)}
                          >
                            {/* Remote video stream */}
                            <video
                              ref={remoteVideoRef}
                              autoPlay
                              playsInline
                              muted={false}
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                backgroundColor: '#000',
                                minWidth: '100%',
                                minHeight: '100%',
                                display: 'block',
                                zIndex: 0
                              }}
                              onLoadedMetadata={(e) => {
                                const video = e.currentTarget;
                                const rect = video.getBoundingClientRect();
                                console.log('[ChatInterface] Remote video metadata loaded');
                                console.log('[ChatInterface] Remote video dimensions:', video.videoWidth, 'x', video.videoHeight);
                                console.log('[ChatInterface] Remote video readyState:', video.readyState);
                                console.log('[ChatInterface] Remote video element rect:', { width: rect.width, height: rect.height });
                                console.log('[ChatInterface] Remote video computed style:', {
                                  width: window.getComputedStyle(video).width,
                                  height: window.getComputedStyle(video).height,
                                  display: window.getComputedStyle(video).display
                                });
                                // Only set hasRemoteVideo to true if video has actual dimensions
                                if (video.videoWidth > 0 && video.videoHeight > 0) {
                                  setHasRemoteVideo(true);
                                } else {
                                  setHasRemoteVideo(false);
                                }
                                video.play().catch(err => {
                                  console.error('Error playing remote video on load:', err);
                                });
                              }}
                              onPlay={() => {
                                const video = remoteVideoRef.current;
                                if (video) {
                                  const rect = video.getBoundingClientRect();
                                  console.log('[ChatInterface] Remote video started playing');
                                  console.log('[ChatInterface] Remote video dimensions:', video.videoWidth, 'x', video.videoHeight);
                                  console.log('[ChatInterface] Remote video currentTime:', video.currentTime);
                                  console.log('[ChatInterface] Remote video element rect:', { width: rect.width, height: rect.height });
                                  // Only set hasRemoteVideo to true if video has actual dimensions
                                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                                    setHasRemoteVideo(true);
                                  } else {
                                    setHasRemoteVideo(false);
                                  }
                                }
                              }}
                              onPause={() => {
                                console.log('[ChatInterface] Remote video paused');
                              }}
                              onError={(e) => {
                                console.error('[ChatInterface] Remote video error:', e);
                                setHasRemoteVideo(false);
                              }}
                              onTimeUpdate={() => {
                                // Video is playing if time is updating
                                const video = remoteVideoRef.current;
                                if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                                  setHasRemoteVideo(true);
                                } else {
                                  // If dimensions are still 0, keep showing fallback
                                  setHasRemoteVideo(false);
                                }
                              }}
                            />
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent z-1"></div>
                            {/* Fallback avatar - only show when no video */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasRemoteVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'} z-10`}>
                              <div className="text-center z-10 px-6">
                                <div className="w-40 h-40 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <p className="text-6xl text-black">{stranger.name[0]}</p>
                                </div>
                                <p className="text-yellow-200 text-2xl">{stranger.name}, {stranger.age}</p>
                              </div>
                            </div>
                            <div className="absolute top-3 left-3 bg-black/70 px-3 py-1 rounded-full border border-yellow-600/30 z-20">
                              <p className="text-yellow-400 text-xs">Stranger</p>
                            </div>
                          </div>
                        )}

                        {/* PiP view (swappable) */}
                        <div 
                          className={`absolute ${isUserViewMain ? 'left-3' : 'right-3'} bottom-24 w-28 h-40 bg-black/60 border border-yellow-600/30 rounded-lg overflow-hidden cursor-pointer hover:border-yellow-500/50 transition-all duration-300 ease-in-out z-20`}
                          onClick={() => setIsUserViewMain(!isUserViewMain)}
                        >
                          {isUserViewMain ? (
                            /* Stranger in PiP */
                            <div className="w-full h-full flex items-center justify-center transition-opacity duration-300 ease-in-out">
                              <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full flex items-center justify-center mx-auto mb-2">
                                  <p className="text-2xl text-black">{stranger.name[0]}</p>
                                </div>
                                <p className="text-yellow-200 text-xs truncate px-1">{stranger.name}, {stranger.age}</p>
                              </div>
                            </div>
                          ) : (
                            /* User in PiP */
                            <>
                              {isVideoEnabled ? (
                                <video
                                  key="user-video-pip"
                                  ref={videoRef}
                                  autoPlay
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover transition-transform duration-300 ease-in-out"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out">
                                  <VideoOff className="w-8 h-8 text-yellow-500/50 mb-2" />
                                  <p className="text-yellow-200/70 text-xs">Camera Off</p>
                                </div>
                              )}
                            </>
                          )}
                          <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded-full border border-yellow-600/30">
                            <p className="text-yellow-400 text-[10px]">{isUserViewMain ? 'Stranger' : 'You'}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Mobile control bar */}
                    <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
                      <div className="mx-auto max-w-md rounded-2xl border-2 border-yellow-500/50 bg-black/90 backdrop-blur-md supports-[backdrop-filter]:bg-black/80 shadow-2xl shadow-yellow-500/20 p-3 flex items-center justify-between gap-2.5">
                        <Button
                          onClick={() => setIsUserViewMain(!isUserViewMain)}
                          variant="outline"
                          size="icon"
                          className="border-2 border-yellow-500/60 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50 hover:border-yellow-400/80 w-11 h-11 rounded-xl shadow-lg disabled:opacity-50"
                          aria-label="Switch camera view"
                          disabled={isConnecting || !stranger}
                        >
                          <RotateCw className="w-5 h-5" />
                        </Button>

                        <Button
                          onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                          variant="outline"
                          size="icon"
                          className={`border-2 hover:border-opacity-80 w-11 h-11 rounded-xl shadow-lg ${
                            isVideoEnabled 
                              ? 'border-yellow-500/60 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50' 
                              : 'border-red-500/60 bg-red-900/30 text-red-300 hover:bg-red-900/50'
                          }`}
                          aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                        >
                          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                        </Button>

                        <Button
                          onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                          variant="outline"
                          size="icon"
                          className={`border-2 hover:border-opacity-80 w-11 h-11 rounded-xl shadow-lg ${
                            isAudioEnabled 
                              ? 'border-yellow-500/60 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50' 
                              : 'border-red-500/60 bg-red-900/30 text-red-300 hover:bg-red-900/50'
                          }`}
                          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                        >
                          {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </Button>

                        <Button
                          onClick={handleSkip}
                          variant="outline"
                          size="icon"
                          className="border-2 border-yellow-500/60 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50 hover:border-yellow-400/80 w-11 h-11 rounded-xl shadow-lg disabled:opacity-50"
                          aria-label="Next person"
                          disabled={isConnecting || !stranger}
                        >
                          <SkipForward className="w-5 h-5" />
                        </Button>

                        <Button
                          onClick={handleExitChat}
                          variant="outline"
                          size="icon"
                          className="border-2 border-red-500/60 bg-red-900/30 text-red-300 hover:bg-red-900/50 hover:border-red-400/80 w-11 h-11 rounded-xl shadow-lg disabled:opacity-50"
                          aria-label="Exit chat"
                          disabled={isConnecting || !stranger}
                        >
                          <PhoneOff className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
                  ) : (
                    <>
                      {isConnecting || !stranger ? (
                        /* Connecting overlay - shows while searching for new person */
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
                          <div className="text-center">
                            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
                              <Loader2 className="w-10 h-10 sm:w-14 sm:h-14 text-black animate-spin" strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl sm:text-2xl text-yellow-400 mb-2">Connecting...</h2>
                            <p className="text-sm sm:text-base text-yellow-200/70 mb-4">Finding someone new</p>
                            <Button
                              onClick={handleCancelConnecting}
                              variant="outline"
                              className="border-red-600/60 bg-red-900/20 text-red-300 hover:bg-red-900/30"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 w-full h-full">
                          {/* Stranger's video - full screen */}
                          <div 
                            className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 to-black flex items-center justify-center relative overflow-hidden w-full h-full"
                          >
                            {/* Remote video stream */}
                            <video
                              ref={remoteVideoRef}
                              autoPlay
                              playsInline
                              muted={false}
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                backgroundColor: '#000',
                                minWidth: '100%',
                                minHeight: '100%',
                                display: 'block',
                                zIndex: 0
                              }}
                              onLoadedMetadata={(e) => {
                                const video = e.currentTarget;
                                const rect = video.getBoundingClientRect();
                                console.log('[ChatInterface] Remote video metadata loaded (desktop)');
                                console.log('[ChatInterface] Remote video dimensions:', video.videoWidth, 'x', video.videoHeight);
                                console.log('[ChatInterface] Remote video readyState:', video.readyState);
                                console.log('[ChatInterface] Remote video element rect:', { width: rect.width, height: rect.height });
                                console.log('[ChatInterface] Remote video computed style:', {
                                  width: window.getComputedStyle(video).width,
                                  height: window.getComputedStyle(video).height,
                                  display: window.getComputedStyle(video).display
                                });
                                // Only set hasRemoteVideo to true if video has actual dimensions
                                if (video.videoWidth > 0 && video.videoHeight > 0) {
                                  setHasRemoteVideo(true);
                                } else {
                                  setHasRemoteVideo(false);
                                }
                                video.play().catch(err => {
                                  console.error('Error playing remote video on load:', err);
                                });
                              }}
                              onPlay={() => {
                                const video = remoteVideoRef.current;
                                if (video) {
                                  const rect = video.getBoundingClientRect();
                                  console.log('[ChatInterface] Remote video started playing (desktop)');
                                  console.log('[ChatInterface] Remote video dimensions:', video.videoWidth, 'x', video.videoHeight);
                                  console.log('[ChatInterface] Remote video currentTime:', video.currentTime);
                                  console.log('[ChatInterface] Remote video element rect:', { width: rect.width, height: rect.height });
                                  // Only set hasRemoteVideo to true if video has actual dimensions
                                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                                    setHasRemoteVideo(true);
                                  } else {
                                    setHasRemoteVideo(false);
                                  }
                                }
                              }}
                              onPause={() => {
                                console.log('[ChatInterface] Remote video paused (desktop)');
                              }}
                              onError={(e) => {
                                console.error('[ChatInterface] Remote video error (desktop):', e);
                                setHasRemoteVideo(false);
                              }}
                              onTimeUpdate={() => {
                                // Video is playing if time is updating
                                const video = remoteVideoRef.current;
                                if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                                  setHasRemoteVideo(true);
                                } else {
                                  // If dimensions are still 0, keep showing fallback
                                  setHasRemoteVideo(false);
                                }
                              }}
                            />
                            {/* Fallback avatar when no video */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hasRemoteVideo ? 'opacity-0 pointer-events-none' : 'opacity-100'} z-10`}>
                              <div className="text-center z-10">
                                <div className="w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4">
                                  <p className="text-3xl sm:text-5xl text-black">{stranger.name[0]}</p>
                                </div>
                                <p className="text-yellow-200 text-base sm:text-xl">{stranger.name}, {stranger.age}</p>
                              </div>
                            </div>
                            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/70 px-2 py-1 sm:px-3 sm:py-1 rounded-full z-20">
                              <p className="text-yellow-400 text-xs sm:text-sm">Stranger</p>
                  </div>
                </div>

                          {/* User's video - floating bottom right */}
                          <div 
                            className="absolute bottom-4 right-4 lg:bottom-6 lg:right-6 w-64 h-48 lg:w-80 lg:h-60 bg-gradient-to-br from-yellow-900/20 to-black border border-yellow-600/30 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ease-in-out z-20 shadow-2xl"
                            onClick={() => setIsUserViewMain(!isUserViewMain)}
                          >
                  {isVideoEnabled ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                                  className="w-full h-full object-cover transition-transform duration-300 ease-in-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent"></div>
                    </>
                  ) : (
                              <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center z-10">
                                  <VideoOff className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500/50 mx-auto mb-2" />
                                  <p className="text-yellow-200/70 text-xs sm:text-sm">Camera Off</p>
                                </div>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded-full">
                              <p className="text-yellow-400 text-xs">You</p>
                            </div>
                          </div>

                      {/* Desktop floating control bar */}
                      {!isMobile && stranger && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
                          <div className="bg-black/90 backdrop-blur-md border border-yellow-600/50 rounded-xl px-3 py-2 shadow-2xl shadow-yellow-500/20">
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => setIsUserViewMain(!isUserViewMain)}
                                variant="outline"
                                size="icon"
                                className="border-yellow-600/50 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50 hover:border-yellow-400/80 w-9 h-9"
                                aria-label="Switch view"
                              >
                                <RotateCw className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                                variant="outline"
                                size="icon"
                                className={`w-9 h-9 ${
                                  isVideoEnabled
                                    ? 'border-yellow-600/50 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50'
                                    : 'border-red-600/50 bg-red-900/30 text-red-300 hover:bg-red-900/50'
                                }`}
                                aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                              >
                                {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                              </Button>
                              <Button
                                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                                variant="outline"
                                size="icon"
                                className={`w-9 h-9 ${
                                  isAudioEnabled
                                    ? 'border-yellow-600/50 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50'
                                    : 'border-red-600/50 bg-red-900/30 text-red-300 hover:bg-red-900/50'
                                }`}
                                aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                              >
                                {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                              </Button>
                              <Button
                                onClick={handleSkip}
                                variant="outline"
                                size="icon"
                                className="border-yellow-600/50 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50 hover:border-yellow-400/80 w-9 h-9"
                                aria-label="Next person"
                              >
                                <SkipForward className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={handleExitChat}
                                variant="outline"
                                size="icon"
                                className="border-red-600/50 bg-red-900/30 text-red-300 hover:bg-red-900/50 hover:border-red-400/80 w-9 h-9"
                                aria-label="Exit chat"
                              >
                                <PhoneOff className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-black min-h-0">
              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-2 sm:space-y-3"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] sm:max-w-xs lg:max-w-md px-3 py-2 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-sm sm:text-base ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
                          : 'bg-yellow-900/30 text-yellow-100 border border-yellow-600/30'
                      }`}
                    >
                      <p className="break-words">{message.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="border-t border-yellow-600/30 p-3 sm:p-4 bg-gradient-to-r from-yellow-900/10 to-yellow-800/5">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="bg-black/50 border-yellow-600/30 text-white placeholder:text-yellow-200/30 focus:border-yellow-500 text-sm sm:text-base h-10 sm:h-11"
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black h-10 sm:h-11 px-3 sm:px-4 flex-shrink-0"
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleExitChat}
                    variant="outline"
                    className="border-red-600/50 text-red-200 hover:bg-red-900/20 h-10 sm:h-11 px-3 sm:px-4 flex-shrink-0"
                    size="sm"
                    aria-label="Exit chat"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <PremiumModal isOpen={isPremiumModalOpen} onClose={() => setIsPremiumModalOpen(false)} />
    </div>
  );
}
