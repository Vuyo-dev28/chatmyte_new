import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../components/auth-context';

export function useSocket() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    // Get server URL from environment or use default
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';
    
    // Warn if using default localhost (server might not be running)
    if (!import.meta.env.VITE_SERVER_URL) {
      console.warn('[Socket] VITE_SERVER_URL not set, using default:', serverUrl);
      console.warn('[Socket] Make sure your server is running on', serverUrl);
    } else {
      console.log('[Socket] Connecting to server:', serverUrl);
    }

    // Connect to server
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Allow fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000, // 10 second timeout
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] ✅ Connected to server:', serverUrl);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      console.error('[Socket] Make sure the server is running on:', serverUrl);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt', attemptNumber);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('[Socket] Failed to reconnect after all attempts');
    });

    return () => {
      console.log('[Socket] Cleaning up socket connection');
      newSocket.close();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  return { socket, isConnected };
}
