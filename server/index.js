import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Server is alive");
});


// Disable caching for all routes
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Store active users and their preferences
const waitingQueue = {
  all: [],
  male: [],
  female: [],
  other: []
};

// Store active connections
const activeConnections = new Map(); // socketId -> { userId, partnerId, gender, tier }

// Helper function to find a match
function findMatch(user) {
  // Check all queues for potential matches
  const queuesToCheck = user.preferredGender && user.preferredGender !== 'all' && user.tier === 'premium'
    ? [waitingQueue[user.preferredGender], waitingQueue.all]
    : [waitingQueue.all, waitingQueue.male, waitingQueue.female, waitingQueue.other];
  
  // Flatten and filter out the current user
  const allWaitingUsers = queuesToCheck
    .flat()
    .filter(u => u && u.socketId !== user.socketId);
  
  // Find a match (first available user)
  const match = allWaitingUsers.find(u => {
    // If user has a preference, check if match meets it
    if (user.preferredGender && user.preferredGender !== 'all' && user.tier === 'premium') {
      return u.gender === user.preferredGender;
    }
    // Otherwise, match with anyone
    return true;
  });
  
  if (match) {
    // Remove match from all queues
    Object.keys(waitingQueue).forEach(key => {
      waitingQueue[key] = waitingQueue[key].filter(u => u.socketId !== match.socketId);
    });
    
    return match;
  }
  
  return null;
}

// Helper function to add user to queue
function addToQueue(user) {
  // Remove from all queues first
  Object.keys(waitingQueue).forEach(key => {
    waitingQueue[key] = waitingQueue[key].filter(u => u.socketId !== user.socketId);
  });
  
  // Add to appropriate queue
  if (user.preferredGender && user.preferredGender !== 'all' && user.tier === 'premium') {
    waitingQueue[user.preferredGender].push(user);
  } else {
    waitingQueue.all.push(user);
  }
}

// Helper function to remove user from all queues
function removeFromQueue(socketId) {
  Object.keys(waitingQueue).forEach(key => {
    waitingQueue[key] = waitingQueue[key].filter(u => u.socketId !== socketId);
  });
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-queue', (userData) => {
    console.log('User joining queue:', socket.id, userData);
    
    const user = {
      socketId: socket.id,
      userId: userData.userId,
      username: userData.username,
      gender: userData.gender,
      preferredGender: userData.preferredGender || 'all',
      tier: userData.tier || 'free',
      age: userData.age || 25
    };
    
    activeConnections.set(socket.id, user);
    
    // Try to find a match BEFORE adding to queue
    const match = findMatch(user);
    
    if (match) {
      console.log('Match found!', socket.id, 'matched with', match.socketId);
      
      // Found a match!
      const matchUser = activeConnections.get(match.socketId);
      
      if (!matchUser) {
        console.error('Match user not found in activeConnections');
        addToQueue(user);
        socket.emit('waiting');
        return;
      }
      
      // Update both users with partner info
      user.partnerId = match.socketId;
      matchUser.partnerId = socket.id;
      activeConnections.set(socket.id, user);
      activeConnections.set(match.socketId, matchUser);
      
      // Notify both users
      socket.emit('matched', {
        partnerId: match.socketId,
        partnerInfo: {
          name: match.username,
          gender: match.gender,
          age: match.age || 25
        }
      });
      
      io.to(match.socketId).emit('matched', {
        partnerId: socket.id,
        partnerInfo: {
          name: user.username,
          gender: user.gender,
          age: user.age || 25
        }
      });
    } else {
      // No match found, add to queue
      console.log('No match found, adding to queue:', socket.id);
      addToQueue(user);
      socket.emit('waiting');
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    const { offer, targetId } = data;
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId === targetId) {
      io.to(targetId).emit('offer', {
        offer,
        fromId: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    const { answer, targetId } = data;
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId === targetId) {
      io.to(targetId).emit('answer', {
        answer,
        fromId: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { candidate, targetId } = data;
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId === targetId) {
      io.to(targetId).emit('ice-candidate', {
        candidate,
        fromId: socket.id
      });
    }
  });

  // Handle messages
  socket.on('message', (data) => {
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId) {
      io.to(user.partnerId).emit('message', {
        text: data.text,
        sender: socket.id,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle skip/disconnect
  socket.on('skip', () => {
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId) {
      // Notify partner
      io.to(user.partnerId).emit('partner-skipped');
      
      // Remove partner connection and put them back in queue
      const partner = activeConnections.get(user.partnerId);
      if (partner) {
        partner.partnerId = null;
        activeConnections.set(user.partnerId, partner);
        
        // Put partner back in queue and start searching
        addToQueue(partner);
        
        // Try to find a match for the partner
        const match = findMatch(partner);
        if (match) {
          console.log('Auto-match found for skipped partner!', partner.socketId, 'matched with', match.socketId);
          
          const matchUser = activeConnections.get(match.socketId);
          if (matchUser) {
            partner.partnerId = match.socketId;
            matchUser.partnerId = partner.socketId;
            activeConnections.set(partner.socketId, partner);
            activeConnections.set(match.socketId, matchUser);
            
            // Notify both users
            io.to(partner.socketId).emit('matched', {
              partnerId: match.socketId,
              partnerInfo: {
                name: match.username,
                gender: match.gender,
                age: match.age || 25
              }
            });
            
            io.to(match.socketId).emit('matched', {
              partnerId: partner.socketId,
              partnerInfo: {
                name: partner.username,
                gender: partner.gender,
                age: partner.age || 25
              }
            });
          } else {
            io.to(partner.socketId).emit('waiting');
          }
        } else {
          io.to(partner.socketId).emit('waiting');
        }
      }
    }
    
    // Remove from queue and reset
    removeFromQueue(socket.id);
    if (user) {
      user.partnerId = null;
      activeConnections.set(socket.id, user);
    }
    
    socket.emit('skipped');
  });

  // Handle explicit leave queue (user exits chat)
  socket.on('leave-queue', () => {
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId) {
      // Notify partner
      io.to(user.partnerId).emit('partner-disconnected');
      
      // Clean up partner and put them back in queue
      const partner = activeConnections.get(user.partnerId);
      if (partner) {
        partner.partnerId = null;
        activeConnections.set(user.partnerId, partner);
        
        // Put partner back in queue and start searching
        addToQueue(partner);
        
        // Try to find a match for the partner
        const match = findMatch(partner);
        if (match) {
          console.log('Auto-match found for exited partner!', partner.socketId, 'matched with', match.socketId);
          
          const matchUser = activeConnections.get(match.socketId);
          if (matchUser) {
            partner.partnerId = match.socketId;
            matchUser.partnerId = partner.socketId;
            activeConnections.set(partner.socketId, partner);
            activeConnections.set(match.socketId, matchUser);
            
            // Notify both users
            io.to(partner.socketId).emit('matched', {
              partnerId: match.socketId,
              partnerInfo: {
                name: match.username,
                gender: match.gender,
                age: match.age || 25
              }
            });
            
            io.to(match.socketId).emit('matched', {
              partnerId: partner.socketId,
              partnerInfo: {
                name: partner.username,
                gender: partner.gender,
                age: partner.age || 25
              }
            });
          } else {
            io.to(partner.socketId).emit('waiting');
          }
        } else {
          io.to(partner.socketId).emit('waiting');
        }
      }
    }
    
    // Remove from queue
    removeFromQueue(socket.id);
    if (user) {
      user.partnerId = null;
      activeConnections.set(socket.id, user);
    }
    
    console.log('User left queue:', socket.id);
  });

  socket.on('disconnect', () => {
    const user = activeConnections.get(socket.id);
    
    if (user && user.partnerId) {
      // Notify partner
      io.to(user.partnerId).emit('partner-disconnected');
      
      // Clean up partner and put them back in queue
      const partner = activeConnections.get(user.partnerId);
      if (partner) {
        partner.partnerId = null;
        activeConnections.set(user.partnerId, partner);
        
        // Put partner back in queue and start searching
        addToQueue(partner);
        
        // Try to find a match for the partner
        const match = findMatch(partner);
        if (match) {
          console.log('Auto-match found for disconnected partner!', partner.socketId, 'matched with', match.socketId);
          
          const matchUser = activeConnections.get(match.socketId);
          if (matchUser) {
            partner.partnerId = match.socketId;
            matchUser.partnerId = partner.socketId;
            activeConnections.set(partner.socketId, partner);
            activeConnections.set(match.socketId, matchUser);
            
            // Notify both users
            io.to(partner.socketId).emit('matched', {
              partnerId: match.socketId,
              partnerInfo: {
                name: match.username,
                gender: match.gender,
                age: match.age || 25
              }
            });
            
            io.to(match.socketId).emit('matched', {
              partnerId: partner.socketId,
              partnerInfo: {
                name: partner.username,
                gender: partner.gender,
                age: partner.age || 25
              }
            });
          } else {
            io.to(partner.socketId).emit('waiting');
          }
        } else {
          io.to(partner.socketId).emit('waiting');
        }
      }
    }
    
    // Remove from queue
    removeFromQueue(socket.id);
    activeConnections.delete(socket.id);
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

