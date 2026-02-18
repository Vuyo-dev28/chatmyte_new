import { useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCOptions {
  socket: Socket | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  partnerId: string | null;
}

export function useWebRTC({
  socket,
  localVideoRef,
  remoteVideoRef,
  isVideoEnabled,
  isAudioEnabled,
  partnerId
}: UseWebRTCOptions) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const partnerIdRef = useRef<string | null>(partnerId);
  
  // Update partnerId ref when it changes
  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  // Initialize WebRTC - only create once per socket
  useEffect(() => {
    if (!socket) return;

    // Don't recreate if peer connection already exists
    if (peerConnectionRef.current) {
      console.log('Peer connection already exists, reusing');
      return;
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    console.log('Creating new peer connection');
    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Handle ICE candidates - use ref to get current partnerId
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        const currentPartnerId = partnerIdRef.current;
        if (currentPartnerId) {
          console.log('[WebRTC] Sending ICE candidate to', currentPartnerId);
          console.log('[WebRTC] Candidate:', event.candidate.candidate?.substring(0, 50) + '...');
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: currentPartnerId
          });
        } else {
          console.log('[WebRTC] No partnerId, cannot send ICE candidate');
        }
      } else if (!event.candidate) {
        console.log('[WebRTC] ICE candidate gathering complete (null candidate)');
      }
    };

    // Handle ICE connection state
    peerConnectionRef.current.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnectionRef.current?.iceConnectionState);
    };

    // Handle connection state
    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnectionRef.current?.connectionState);
    };

    // Handle remote stream - MUST be registered before setting remote description
    peerConnectionRef.current.ontrack = (event) => {
      console.log('[WebRTC] ========== ontrack event fired! ==========');
      console.log('[WebRTC] Track kind:', event.track.kind);
      console.log('[WebRTC] Track id:', event.track.id);
      console.log('[WebRTC] Streams count:', event.streams.length);
      console.log('[WebRTC] Track enabled:', event.track.enabled);
      console.log('[WebRTC] Track readyState:', event.track.readyState);
      console.log('[WebRTC] Event streams:', event.streams);
      
      if (remoteVideoRef.current) {
        let streamToSet: MediaStream | null = null;
        
        if (event.streams && event.streams.length > 0) {
          console.log('[WebRTC] Using stream from event.streams[0]');
          streamToSet = event.streams[0];
        } else if (event.track) {
          // Fallback: create a new stream from the track
          console.log('[WebRTC] Creating stream from track (fallback)');
          streamToSet = new MediaStream([event.track]);
        }
        
        if (streamToSet) {
          console.log('[WebRTC] Setting remote video srcObject');
          console.log('[WebRTC] Stream ID:', streamToSet.id);
          console.log('[WebRTC] Stream tracks:', streamToSet.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })));
          
          remoteVideoRef.current.srcObject = streamToSet;
          
          // Ensure video element is visible and playing
          remoteVideoRef.current.style.display = 'block';
          remoteVideoRef.current.style.zIndex = '1';
          
          // Force play with multiple attempts
          const playVideo = async () => {
            try {
              await remoteVideoRef.current!.play();
              console.log('[WebRTC] ✅ Remote video playing successfully');
              
              // Verify video is actually playing
              if (remoteVideoRef.current) {
                console.log('[WebRTC] Video element state:', {
                  paused: remoteVideoRef.current.paused,
                  readyState: remoteVideoRef.current.readyState,
                  videoWidth: remoteVideoRef.current.videoWidth,
                  videoHeight: remoteVideoRef.current.videoHeight,
                  srcObject: !!remoteVideoRef.current.srcObject
                });
              }
            } catch (err: any) {
              console.error('[WebRTC] ❌ Error playing remote video:', err);
              // Retry after a short delay
              setTimeout(() => {
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play().catch(e => {
                    console.error('[WebRTC] Retry failed:', e);
                  });
                }
              }, 500);
            }
          };
          
          // Wait for metadata to load before playing
          if (remoteVideoRef.current.readyState >= 2) {
            // Already has metadata
            playVideo();
          } else {
            remoteVideoRef.current.onloadedmetadata = () => {
              console.log('[WebRTC] Video metadata loaded');
              playVideo();
            };
          }
        } else {
          console.warn('[WebRTC] No stream or track available in ontrack event');
        }
      } else {
        console.warn('[WebRTC] ⚠️ remoteVideoRef.current is null! Cannot set remote stream.');
      }
    };

    return () => {
      // Only cleanup on unmount
      if (peerConnectionRef.current) {
        console.log('Cleaning up peer connection');
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [socket, partnerId]);

  // Get user media and add tracks to peer connection
  useEffect(() => {
    const getMedia = async () => {
      try {
        // Stop existing stream first
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: isAudioEnabled
        });

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(err => {
            console.error('Error playing local video:', err);
          });
        }

        // Remove old tracks and add new ones
        if (peerConnectionRef.current) {
          // Remove existing senders
          const senders = peerConnectionRef.current.getSenders();
          senders.forEach(sender => {
            if (sender.track) {
              peerConnectionRef.current?.removeTrack(sender);
            }
          });

          // Add new tracks
          stream.getTracks().forEach(track => {
            if (peerConnectionRef.current) {
              console.log('Adding track to peer connection:', track.kind);
              peerConnectionRef.current.addTrack(track, stream);
            }
          });
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    if (socket && peerConnectionRef.current) {
      getMedia();
    }

    return () => {
      // Don't stop tracks here, let them persist
    };
  }, [socket, isVideoEnabled, isAudioEnabled, localVideoRef]);

  // Replace tracks when video/audio toggles (requires renegotiation)
  useEffect(() => {
    if (!peerConnectionRef.current || !partnerId || !socket || !localStreamRef.current) return;
    
    const updateVideoTrack = async () => {
      try {
        const senders = peerConnectionRef.current?.getSenders() || [];
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        
        if (isVideoEnabled) {
          // If we have a track but it's disabled, re-enable it
          if (currentVideoTrack && videoSender) {
            console.log('Re-enabling video track');
            currentVideoTrack.enabled = true;
            // Renegotiate to notify remote peer
            if (peerConnectionRef.current.signalingState === 'stable') {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              socket.emit('offer', {
                offer,
                targetId: partnerId
              });
            }
          } else if (!currentVideoTrack) {
            // Get new video track if we don't have one
            console.log('Getting new video track');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = stream.getVideoTracks()[0];
            
            if (videoSender) {
              // Replace existing track
              await videoSender.replaceTrack(newVideoTrack);
              if (videoSender.track && videoSender.track !== newVideoTrack) {
                videoSender.track.stop();
              }
            } else {
              // Add new track
              if (peerConnectionRef.current) {
                peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
              }
            }
            
            // Add to local stream
            localStreamRef.current.addTrack(newVideoTrack);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
            
            // Renegotiate
            if (peerConnectionRef.current.signalingState === 'stable') {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              socket.emit('offer', {
                offer,
                targetId: partnerId
              });
            }
          }
        } else {
          // Disable video track
          if (currentVideoTrack) {
            console.log('Disabling video track');
            currentVideoTrack.enabled = false;
            // Clear local video element to prevent frozen frame
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
            }
            // Renegotiate to notify remote peer
            if (peerConnectionRef.current.signalingState === 'stable') {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              socket.emit('offer', {
                offer,
                targetId: partnerId
              });
            }
          } else {
            // Clear video element if no track exists
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = null;
            }
          }
        }
      } catch (error) {
        console.error('Error updating video track:', error);
      }
    };
    
    // Only update if we have a partner
    if (partnerId) {
      updateVideoTrack();
    }
  }, [isVideoEnabled, partnerId, socket]);

  useEffect(() => {
    if (!peerConnectionRef.current || !partnerId || !socket || !localStreamRef.current) return;
    
    const updateAudioTrack = async () => {
      try {
        const senders = peerConnectionRef.current?.getSenders() || [];
        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
        const currentAudioTrack = localStreamRef.current.getAudioTracks()[0];
        
        if (isAudioEnabled) {
          // If we have a track but it's disabled, re-enable it
          if (currentAudioTrack && audioSender) {
            console.log('Re-enabling audio track');
            currentAudioTrack.enabled = true;
            // Renegotiate to notify remote peer
            if (peerConnectionRef.current.signalingState === 'stable') {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              socket.emit('offer', {
                offer,
                targetId: partnerId
              });
            }
          } else if (!currentAudioTrack) {
            // Get new audio track if we don't have one
            console.log('Getting new audio track');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const newAudioTrack = stream.getAudioTracks()[0];
            
            if (audioSender) {
              // Replace existing track
              await audioSender.replaceTrack(newAudioTrack);
              if (audioSender.track && audioSender.track !== newAudioTrack) {
                audioSender.track.stop();
              }
            } else {
              // Add new track
              if (peerConnectionRef.current) {
                peerConnectionRef.current.addTrack(newAudioTrack, localStreamRef.current);
              }
            }
            
            // Add to local stream
            localStreamRef.current.addTrack(newAudioTrack);
            
            // Renegotiate
            if (peerConnectionRef.current.signalingState === 'stable') {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              socket.emit('offer', {
                offer,
                targetId: partnerId
              });
            }
          }
        } else {
          // Disable audio track
          if (currentAudioTrack) {
            console.log('Disabling audio track');
            currentAudioTrack.enabled = false;
            // Renegotiate to notify remote peer
            if (peerConnectionRef.current.signalingState === 'stable') {
              const offer = await peerConnectionRef.current.createOffer();
              await peerConnectionRef.current.setLocalDescription(offer);
              socket.emit('offer', {
                offer,
                targetId: partnerId
              });
            }
          }
        }
      } catch (error) {
        console.error('Error updating audio track:', error);
      }
    };
    
    // Only update if we have a partner
    if (partnerId) {
      updateAudioTrack();
    }
  }, [isAudioEnabled, partnerId, socket]);

  const createOffer = async (targetId: string) => {
    if (!peerConnectionRef.current || !socket || !targetId) {
      console.log('[WebRTC] Cannot create offer:', { 
        hasPeerConnection: !!peerConnectionRef.current, 
        hasSocket: !!socket, 
        targetId 
      });
      return;
    }

    try {
      const state = peerConnectionRef.current.signalingState;
      console.log('[WebRTC] Current signaling state before creating offer:', state);
      
      // Only create offer if we're in stable state
      if (state !== 'stable') {
        console.warn('[WebRTC] Not in stable state, cannot create offer. Current state:', state);
        return;
      }

      // CRITICAL: Ensure we have tracks BEFORE creating offer
      const senders = peerConnectionRef.current.getSenders();
      console.log('[WebRTC] Current senders count:', senders.length);
      
      if (senders.length === 0) {
        // No tracks added yet - we MUST add them before creating offer
        if (!localStreamRef.current) {
          console.error('[WebRTC] No local stream available! Cannot create offer without tracks.');
          // Try to get media first
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: isVideoEnabled,
              audio: isAudioEnabled
            });
            localStreamRef.current = stream;
            
            // Add to local video element
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.play().catch(err => {
                console.error('[WebRTC] Error playing local video:', err);
              });
            }
          } catch (mediaError) {
            console.error('[WebRTC] Failed to get media:', mediaError);
            return;
          }
        }
        
        // Add all tracks to peer connection
        console.log('[WebRTC] Adding tracks to peer connection before creating offer');
        localStreamRef.current.getTracks().forEach(track => {
          if (peerConnectionRef.current) {
            console.log('[WebRTC] Adding track:', track.kind, track.id);
            peerConnectionRef.current.addTrack(track, localStreamRef.current!);
          }
        });
        
        // Verify tracks were added
        const newSenders = peerConnectionRef.current.getSenders();
        console.log('[WebRTC] Tracks added. New senders count:', newSenders.length);
        if (newSenders.length === 0) {
          console.error('[WebRTC] Failed to add tracks! Cannot create offer.');
          return;
        }
      } else {
        // Verify all tracks are enabled
        senders.forEach(sender => {
          if (sender.track) {
            console.log('[WebRTC] Existing sender:', sender.track.kind, 'enabled:', sender.track.enabled);
          }
        });
      }

      console.log('[WebRTC] Creating offer for', targetId);
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log('[WebRTC] Offer created successfully:', offer.type);
      console.log('[WebRTC] Offer SDP (first 200 chars):', offer.sdp?.substring(0, 200));
      
      console.log('[WebRTC] Setting local description');
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('[WebRTC] Local description set, signaling state:', peerConnectionRef.current.signalingState);

      console.log('[WebRTC] Emitting offer to', targetId);
      socket.emit('offer', {
        offer,
        targetId
      });
      console.log('[WebRTC] Offer sent successfully');
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, fromId: string) => {
    if (!peerConnectionRef.current || !socket) {
      console.log('[WebRTC] Cannot handle offer:', { 
        hasPeerConnection: !!peerConnectionRef.current, 
        hasSocket: !!socket 
      });
      return;
    }

    try {
      const state = peerConnectionRef.current.signalingState;
      console.log('[WebRTC] Received offer from', fromId);
      console.log('[WebRTC] Current signaling state before offer:', state);
      
      // If we're not in stable state, we might be in the middle of another negotiation
      if (state !== 'stable') {
        console.warn('[WebRTC] Not in stable state, current state:', state);
        // Try to rollback or wait
        if (state === 'have-local-offer') {
          // We already sent an offer, wait a bit or rollback
          console.log('[WebRTC] Already have local offer, waiting...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // CRITICAL: Ensure we have tracks BEFORE setting remote description and creating answer
      const senders = peerConnectionRef.current.getSenders();
      console.log('[WebRTC] Current senders count before handling offer:', senders.length);
      
      if (senders.length === 0) {
        // No tracks added yet - we MUST add them
        if (!localStreamRef.current) {
          console.log('[WebRTC] No local stream, getting media before handling offer');
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: isVideoEnabled,
              audio: isAudioEnabled
            });
            localStreamRef.current = stream;
            
            // Add to local video element
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
              localVideoRef.current.play().catch(err => {
                console.error('[WebRTC] Error playing local video:', err);
              });
            }
          } catch (mediaError) {
            console.error('[WebRTC] Failed to get media:', mediaError);
            return;
          }
        }
        
        // Add all tracks to peer connection
        console.log('[WebRTC] Adding tracks to peer connection before handling offer');
        localStreamRef.current.getTracks().forEach(track => {
          if (peerConnectionRef.current) {
            console.log('[WebRTC] Adding track:', track.kind, track.id);
            peerConnectionRef.current.addTrack(track, localStreamRef.current!);
          }
        });
        
        // Verify tracks were added
        const newSenders = peerConnectionRef.current.getSenders();
        console.log('[WebRTC] Tracks added. New senders count:', newSenders.length);
      }

      // Step 1: Set remote description (ontrack is already registered above)
      console.log('[WebRTC] Setting remote offer from', fromId);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Remote offer set successfully, signaling state:', peerConnectionRef.current.signalingState);
      
      // Step 2: Create answer
      console.log('[WebRTC] Creating answer');
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      console.log('[WebRTC] Answer created successfully:', answer.type);
      
      // Step 3: Set local description
      console.log('[WebRTC] Setting local description (answer)');
      await peerConnectionRef.current.setLocalDescription(answer);
      console.log('[WebRTC] Local description set, signaling state:', peerConnectionRef.current.signalingState);

      // Step 4: Emit answer
      console.log('[WebRTC] Emitting answer to', fromId);
      socket.emit('answer', {
        answer,
        targetId: fromId
      });
      console.log('[WebRTC] Answer sent successfully');
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.log('[WebRTC] No peer connection for answer');
      return;
    }

    try {
      const state = peerConnectionRef.current.signalingState;
      console.log('[WebRTC] Received answer');
      console.log('[WebRTC] Current signaling state before answer:', state);
      
      // Only set remote description if we're in the right state
      if (state === 'have-local-offer') {
        console.log('[WebRTC] Setting remote answer (we have local offer)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[WebRTC] Remote answer set successfully, new state:', peerConnectionRef.current.signalingState);
        console.log('[WebRTC] Connection should be established now');
      } else if (state === 'stable') {
        // If we're in stable, we might have already processed this or the offer wasn't set
        console.warn('[WebRTC] In stable state when answer received - offer may not have been set yet');
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 100));
        const newState = peerConnectionRef.current.signalingState;
        if (newState === 'have-local-offer') {
          console.log('[WebRTC] State changed to have-local-offer, setting answer now');
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.error('[WebRTC] Still in wrong state after wait:', newState);
        }
      } else {
        console.warn('[WebRTC] Cannot set remote answer, wrong state:', state);
      }
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) {
      console.log('[WebRTC] No peer connection for ICE candidate');
      return;
    }

    try {
      console.log('[WebRTC] Adding ICE candidate');
      console.log('[WebRTC] Candidate:', candidate.candidate?.substring(0, 50) + '...');
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added successfully');
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  };

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    peerConnection: peerConnectionRef.current
  };
}
