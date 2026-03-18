import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { paypalService } from './paypal.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Initialize PayPal
paypalService.initialize({
  clientId: process.env.VITE_PAYPAL_CLIENT_ID,
  clientSecret: process.env.VITE_PAYPAL_CLIENT_SECRET,
  mode: process.env.VITE_PAYPAL_MODE || 'sandbox'
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
const activeConnections = new Map(); // socketId -> { userId, partnerId, gender, tier, country, connectedAt }

// Admin verification
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@chatmyte.com";

// Geolocation helper
async function getGeoLocation(ip) {
  console.log('[Geo] Detecting origin for IP:', ip);
  
  // Local/Private IP ranges check
  const isLocal = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
  if (isLocal) return { country: 'Local Network' };
  
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();
    
    if (data.status === 'fail') {
      console.warn('[Geo] Lookup failed for IP:', ip, 'Reason:', data.message);
      return { country: 'Unknown' };
    }
    
    return { country: data.country || 'Unknown' };
  } catch (err) {
    console.error('[Geo] API Error:', err.message);
    return { country: 'Unknown' };
  }
}

// Function to get admin stats
async function getAdminStats() {
  const users = Array.from(activeConnections.values());
  const stats = {
    totalOnline: users.length,
    queues: {
      all: waitingQueue.all.length,
      male: waitingQueue.male.length,
      female: waitingQueue.female.length,
      other: waitingQueue.other.length
    },
    genders: {
      male: users.filter(u => u.gender === 'male').length,
      female: users.filter(u => u.gender === 'female').length,
      other: users.filter(u => u.gender === 'other').length
    },
    tiers: {
      free: users.filter(u => u.tier === 'free').length,
      premium: users.filter(u => u.tier === 'premium').length
    },
    inChat: users.filter(u => u.partnerId).length,
    countries: {},
    users: users.map(u => ({
      socketId: u.socketId,
      userId: u.userId,
      username: u.username,
      gender: u.gender,
      tier: u.tier,
      country: u.country,
      is_admin: !!u.is_admin,
      partnerId: u.partnerId
    }))
  };

  // Fetch historical stats
  try {
    const { data: historicalData } = await supabase.rpc('get_historical_stats');
    stats.historical = historicalData || [];
  } catch (err) {
    console.warn('[Admin] Failed to fetch historical stats:', err.message);
    stats.historical = [];
  }

  return stats;
}

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
    // 🛡️ Rematch Prevention
    if (user.lastPartnerId === u.socketId || u.lastPartnerId === user.socketId) {
      return false;
    }

    // If user has a preference, check if match meets it
    if (user.preferredGender && user.preferredGender !== 'all' && user.tier === 'premium') {
      if (u.gender !== user.preferredGender) return false;
    }

    // If the match has a preference, check if user meets it
    if (u.preferredGender && u.preferredGender !== 'all' && u.tier === 'premium') {
      if (user.gender !== u.preferredGender) return false;
    }

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

io.on('connection', async (socket) => {
  const ip = socket.handshake.address.replace('::ffff:', '');
  const geo = await getGeoLocation(ip);
  console.log('User connected:', socket.id, 'from', geo.country);

  // Increment daily visitor count
  try {
    await supabase.rpc('increment_daily_visitor');
  } catch (err) {
    console.error('[Analytics] Failed to increment visitor count:', err.message);
  }

  // Stats broadcast
    const broadcastStats = async () => {
      const stats = await getAdminStats();
      io.to('admin_room').emit('admin:stats-update', stats);
    };

    socket.on('identify', (userId) => {
      console.log(`[Socket] Identifying socket ${socket.id} as user ${userId}`);
      socket.userId = userId;
    });

    socket.on('subscription:cancel', async ({ subscriptionId, reason, userId }) => {
      try {
        const effectiveUserId = userId || socket.userId || '';
        console.log(`[Subscription] Cancelling ${subscriptionId} for user ${effectiveUserId}`);
        
        // 1. Get subscription details bypassing RLS via RPC
        const { data: subscription, error: fetchError } = await supabase
          .rpc('get_subscription_admin', { 
            sub_id: subscriptionId, 
            u_id: effectiveUserId 
          })
          .maybeSingle();

        if (fetchError || !subscription) {
          console.error('[Subscription] Not found or unauthorized:', fetchError || 'No record found');
          socket.emit('subscription:cancel-error', { message: 'Subscription not found' });
          return;
        }

        // 2. Cancel in PayPal if applicable
        if (subscription.payment_provider === 'paypal' && subscription.payment_provider_subscription_id) {
          try {
            await paypalService.cancelSubscription(subscription.payment_provider_subscription_id, reason);
          } catch (paypalError) {
            console.error('[PayPal] Cancellation failed:', paypalError.message);
            // We continue anyway to update our DB status
          }
        }

        // 3. Update Supabase bypassing RLS via RPC
        const { error: updateError } = await supabase
          .rpc('mark_subscription_cancelled_admin', { 
            sub_id: subscriptionId 
          });

        if (updateError) throw updateError;

        socket.emit('subscription:cancel-success', { subscriptionId });
        console.log(`[Subscription] Successfully cancelled ${subscriptionId}`);
        
        // Broadcast stats refresh to admins
        broadcastStats();
      } catch (error) {
        console.error('[Subscription] Cancel error:', error);
        socket.emit('subscription:cancel-error', { message: error.message });
      }
    });

    // --- Admin Events ---
    socket.on('admin:join', async (email) => {
      // 1. Basic email check for fast filter
      if (email === ADMIN_EMAIL || email.endsWith('@chatmyte.com')) {
        socket.join('admin_room');
        const stats = await getAdminStats();
        socket.emit('admin:stats-update', stats);
        return;
      }

      // 2. Database check for other admins
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', socket.userId || '')
          .single();

        if (profile?.is_admin) {
          socket.join('admin_room');
          const stats = await getAdminStats();
          socket.emit('admin:stats-update', stats);
        }
      } catch (err) {
        console.error('[Admin] Join error:', err.message);
      }
    });

    socket.on('admin:toggle-rights', async ({ targetUserId, isAdmin }) => {
    // Verify caller is an admin
    const callerId = Array.from(activeConnections.values()).find(u => u.socketId === socket.id)?.userId;
    if (!callerId) return;

    const { data: caller } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', callerId)
      .single();

    if (!caller?.is_admin) return;

    // Perform update
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: isAdmin })
      .eq('id', targetUserId);

    if (!error) {
      // Update local state if user is online
      activeConnections.forEach((val, key) => {
        if (val.userId === targetUserId) {
          val.is_admin = isAdmin;
          activeConnections.set(key, val);
          // Notify the user if they are online? Maybe just wait for refresh
        }
      });
      broadcastStats();
    }
  });

  socket.on('join-queue', async (userData) => {
    console.log('User joining queue:', socket.id, userData);
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userData.userId)
      .single();

    socket.userId = userData.userId;
    socket.is_admin = !!profile?.is_admin;

    const user = {
      socketId: socket.id,
      userId: userData.userId,
      username: userData.username,
      gender: userData.gender,
      preferredGender: userData.preferredGender || 'all',
      tier: userData.tier || 'free',
      age: userData.age,
      is_admin: socket.is_admin,
      country: geo.country,
      connectedAt: new Date().toISOString()
    };
    
    activeConnections.set(socket.id, user);
    broadcastStats();
    
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
          age: match.age || 18
        }
      });
      
      io.to(match.socketId).emit('matched', {
        partnerId: socket.id,
        partnerInfo: {
          name: user.username,
          gender: user.gender,
          age: user.age || 18
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
    const { offer, to } = data;
    const user = activeConnections.get(socket.id);
    
    // Support both 'to' and 'targetId' for backward compatibility
    const targetId = to || data.targetId;
    
    if (user && user.partnerId === targetId) {
      io.to(targetId).emit('offer', {
        offer,
        fromId: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    const { answer, to } = data;
    const user = activeConnections.get(socket.id);
    
    // Support both 'to' and 'targetId' for backward compatibility
    const targetId = to || data.targetId;
    
    if (user && user.partnerId === targetId) {
      io.to(targetId).emit('answer', {
        answer,
        fromId: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { candidate, to } = data;
    const user = activeConnections.get(socket.id);
    
    // Support both 'to' and 'targetId' for backward compatibility
    const targetId = to || data.targetId;
    
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
        partner.lastPartnerId = socket.id; // Mark for rematch prevention
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
      user.lastPartnerId = user.partnerId; // Mark for rematch prevention
      user.partnerId = null;
      activeConnections.set(socket.id, user);

      // Clear lastPartnerId after 30 seconds to allow possible rematch
      setTimeout(() => {
        const u = activeConnections.get(socket.id);
        if (u) {
          u.lastPartnerId = null;
          activeConnections.set(socket.id, u);
        }
      }, 30000);
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
        partner.lastPartnerId = socket.id; // Mark for rematch prevention
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
        partner.lastPartnerId = socket.id; // Mark for rematch prevention
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
    
    removeFromQueue(socket.id);
    activeConnections.delete(socket.id);
    getAdminStats().then(stats => {
      io.to('admin_room').emit('admin:stats-update', stats);
    });
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

