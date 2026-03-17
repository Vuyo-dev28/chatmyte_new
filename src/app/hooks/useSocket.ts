import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../components/auth-context';

// Singleton instance to be shared across the app
let globalSocket: Socket | null = null;
let listenersCount = 0;

export function useSocket() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState(globalSocket?.connected || false);

  useEffect(() => {
    if (!user) {
      if (globalSocket) {
        console.log('[Socket] User logged out, closing socket');
        globalSocket.close();
        globalSocket = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    listenersCount++;

    if (!globalSocket) {
      // Get server URL from environment or use default
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';
      
      console.log('[Socket] Creating new singleton connection to:', serverUrl);

      // Connect to server
      globalSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      setSocket(globalSocket);

      globalSocket.on('connect', () => {
        console.log('[Socket] ✅ Connected to server:', serverUrl);
        setIsConnected(true);
        if (user?.id) {
          console.log('[Socket] Identifying user:', user.id);
          globalSocket?.emit('identify', user.id);
        }
      });

      globalSocket.on('disconnect', (reason) => {
        console.log('[Socket] ❌ Disconnected from server. Reason:', reason);
        setIsConnected(false);
      });

      globalSocket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
      });
    } else {
      // Re-identify if user changed or just for safety
      if (globalSocket.connected && user?.id) {
        globalSocket.emit('identify', user.id);
      }
      setSocket(globalSocket);
      setIsConnected(globalSocket.connected);
    }

    return () => {
      listenersCount--;
      // We don't close the socket on unmount because it's a singleton
      // It stays open as long as the user is logged in
    };
  }, [user]);

  return { socket, isConnected };
}
