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
          console.log('Sending ICE candidate to', currentPartnerId);
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            targetId: currentPartnerId
          });
        } else {
          console.log('No partnerId, storing candidate for later');
        }
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

    // Handle remote stream
    peerConnectionRef.current.ontrack = (event) => {
      console.log('Received remote track:', event);
      if (remoteVideoRef.current && event.streams && event.streams[0]) {
        console.log('Setting remote video stream');
        remoteVideoRef.current.srcObject = event.streams[0];
        // Force play
        remoteVideoRef.current.play().catch(err => {
          console.error('Error playing remote video:', err);
        });
      } else if (remoteVideoRef.current && event.track) {
        // Fallback: create a new stream from the track
        console.log('Creating stream from track');
        const stream = new MediaStream([event.track]);
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play().catch(err => {
          console.error('Error playing remote video:', err);
        });
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
      console.log('Cannot create offer:', { 
        hasPeerConnection: !!peerConnectionRef.current, 
        hasSocket: !!socket, 
        targetId 
      });
      return;
    }

    try {
      const state = peerConnectionRef.current.signalingState;
      console.log('Current signaling state before creating offer:', state);
      
      // Only create offer if we're in stable state
      if (state !== 'stable') {
        console.warn('Not in stable state, cannot create offer. Current state:', state);
        return;
      }

      // Make sure we have tracks before creating offer
      const senders = peerConnectionRef.current.getSenders();
      if (senders.length === 0 && localStreamRef.current) {
        console.log('Adding tracks before creating offer');
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
        });
      }

      console.log('Creating offer for', targetId);
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log('Offer created, setting local description');
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('Local description set, signaling state:', peerConnectionRef.current.signalingState);

      console.log('Sending offer to', targetId);
      socket.emit('offer', {
        offer,
        targetId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, fromId: string) => {
    if (!peerConnectionRef.current || !socket) {
      console.log('Cannot handle offer:', { 
        hasPeerConnection: !!peerConnectionRef.current, 
        hasSocket: !!socket 
      });
      return;
    }

    try {
      const state = peerConnectionRef.current.signalingState;
      console.log('Current signaling state before offer:', state);
      
      // If we're not in stable state, we might be in the middle of another negotiation
      if (state !== 'stable') {
        console.warn('Not in stable state, current state:', state);
        // Try to rollback or wait
        if (state === 'have-local-offer') {
          // We already sent an offer, wait a bit or rollback
          console.log('Already have local offer, waiting...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Make sure we have tracks before creating answer
      const senders = peerConnectionRef.current.getSenders();
      if (senders.length === 0 && localStreamRef.current) {
        console.log('Adding tracks before handling offer');
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current?.addTrack(track, localStreamRef.current!);
        });
      }

      console.log('Setting remote offer from', fromId);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote offer set, creating answer');
      
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      console.log('Answer created, setting local description');
      await peerConnectionRef.current.setLocalDescription(answer);

      console.log('Sending answer to', fromId);
      socket.emit('answer', {
        answer,
        targetId: fromId
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      console.log('No peer connection for answer');
      return;
    }

    try {
      const state = peerConnectionRef.current.signalingState;
      console.log('Current signaling state before answer:', state);
      
      // Only set remote description if we're in the right state
      if (state === 'have-local-offer') {
        console.log('Setting remote answer');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote answer set successfully, new state:', peerConnectionRef.current.signalingState);
      } else if (state === 'stable') {
        // If we're in stable, we might have already processed this or the offer wasn't set
        console.warn('In stable state when answer received - offer may not have been set yet');
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 100));
        const newState = peerConnectionRef.current.signalingState;
        if (newState === 'have-local-offer') {
          console.log('State changed to have-local-offer, setting answer now');
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.error('Still in wrong state after wait:', newState);
        }
      } else {
        console.warn('Cannot set remote answer, wrong state:', state);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
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
