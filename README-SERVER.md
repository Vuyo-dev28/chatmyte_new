# ChatMyte - Real-time Server Setup

This application now includes a real-time server for live video chat and messaging.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   Create a `.env` file in the root directory:
   ```
   VITE_SERVER_URL=http://localhost:3001
   PORT=3001
   CLIENT_URL=http://localhost:5173
   ```

3. **Run the development server:**
   ```bash
   # Run both frontend and backend together
   npm run dev:all
   
   # Or run separately:
   # Frontend only
   npm run dev
   
   # Backend only
   npm run dev:server
   ```

## Features

- **Real-time matching**: Users are matched based on gender preferences
- **WebRTC video/audio**: Peer-to-peer video and audio streaming
- **Real-time messaging**: Instant message delivery via WebSocket
- **Queue system**: Users wait in a queue until a match is found
- **Premium features**: Gender filtering for premium users

## Server Endpoints

The server runs on `http://localhost:3001` by default.

### Socket Events

**Client → Server:**
- `join-queue`: Join the matching queue
- `offer`: Send WebRTC offer
- `answer`: Send WebRTC answer
- `ice-candidate`: Send ICE candidate
- `message`: Send a text message
- `skip`: Skip current partner

**Server → Client:**
- `matched`: Match found with partner info
- `waiting`: Waiting in queue
- `message`: Receive a text message
- `offer`: Receive WebRTC offer
- `answer`: Receive WebRTC answer
- `ice-candidate`: Receive ICE candidate
- `partner-skipped`: Partner skipped the call
- `partner-disconnected`: Partner disconnected
- `skipped`: Successfully skipped

## WebRTC

The application uses WebRTC for peer-to-peer video/audio communication. The server acts as a signaling server to exchange SDP offers/answers and ICE candidates between peers.

## Notes

- Make sure to allow camera and microphone permissions in your browser
- The server uses STUN servers for NAT traversal (Google's public STUN servers)
- For production, you may want to add TURN servers for better connectivity
