import React, { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { useSocket } from '../hooks/useSocket';
import { 
  Users, 
  Globe, 
  Activity, 
  ArrowLeft,
  ChevronRight,
  User as UserIcon,
  ShieldCheck,
  Crown,
  LayoutDashboard,
  Filter
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminUser {
  socketId: string;
  userId: string;
  username: string;
  gender: string;
  tier: string;
  country: string;
  is_admin: boolean;
  partnerId: string | null;
}

interface AdminStats {
  totalOnline: number;
  queues: {
    all: number;
    male: number;
    female: number;
    other: number;
  };
  genders: {
    male: number;
    female: number;
    other: number;
  };
  tiers: {
    free: number;
    premium: number;
  };
  inChat: number;
  countries: Record<string, number>;
  users: AdminUser[];
}

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!socket || !user) return;

    // Join admin room
    socket.emit('admin:join', user.email);

    socket.on('admin:stats-update', (newStats: AdminStats) => {
      setStats(newStats);
    });

    return () => {
      socket.off('admin:stats-update');
    };
  }, [socket, user]);

  const handleToggleAdmin = (targetUserId: string, currentStatus: boolean) => {
    if (!socket || !user) return;
    socket.emit('admin:toggle-rights', { 
      targetUserId, 
      isAdmin: !currentStatus 
    });
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading live stats...</p>
        </div>
      </div>
    );
  }

  const genderData = [
    { name: 'Male', value: stats.genders.male, color: '#3b82f6' },
    { name: 'Female', value: stats.genders.female, color: '#ec4899' },
    { name: 'Other', value: stats.genders.other, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  const countryData = Object.entries(stats.countries)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#EAB308', '#3B82F6', '#EC4899', '#8B5CF6'];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-yellow-500 mb-2">
              <LayoutDashboard size={20} />
              <span className="text-xs font-bold uppercase tracking-wider">Admin Control Panel</span>
            </div>
            <h1 className="text-3xl font-black italic">LIVE COMMAND CENTER</h1>
            <p className="text-zinc-500">Monitoring {stats.totalOnline} active users globally</p>
          </div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-bold"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={<Users className="text-yellow-500" />} 
            label="Total Online" 
            value={stats.totalOnline.toString()} 
            subValue="Real-time connections"
          />
          <StatCard 
            icon={<Activity className="text-green-500" />} 
            label="In Active Chat" 
            value={stats.inChat.toString()} 
            subValue={`${Math.round((stats.inChat / (stats.totalOnline || 1)) * 100)}% engagement`}
          />
          <StatCard 
            icon={<Filter className="text-blue-500" />} 
            label="In Waiting Queue" 
            value={(stats.totalOnline - stats.inChat).toString()} 
            subValue="Across all filters"
          />
          <StatCard 
            icon={<ShieldCheck className="text-purple-500" />} 
            label="Premium Users" 
            value={stats.tiers.premium.toString()} 
            subValue={`${stats.tiers.free} free users`}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gender Distribution */}
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <UserIcon size={20} className="text-zinc-400" />
              Gender Distribution
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              {genderData.map((d) => (
                <div key={d.name} className="flex flex-col items-center">
                  <span className="text-xs text-zinc-500 font-bold uppercase">{d.name}</span>
                  <span className="text-xl font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Locations */}
          <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Globe size={20} className="text-zinc-400" />
              Top Locations
            </h3>
            <div className="space-y-4">
              {countryData.length > 0 ? (
                countryData.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                        #{i + 1}
                      </div>
                      <span className="font-bold">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500" 
                          style={{ width: `${(c.value / (stats.totalOnline || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-yellow-500">{c.value}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex items-center justify-center text-zinc-600 italic">
                  No location data available yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Logs / Recent Activity placeholder */}
        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5">
          <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-green-500" />
              Queue Breakdown
            </div>
            <span className="text-xs font-mono text-zinc-500">AUTO-REFRESHING</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <QueueBox label="Global" count={stats.queues.all} color="text-yellow-500" />
            <QueueBox label="Men" count={stats.queues.male} color="text-blue-500" />
            <QueueBox label="Women" count={stats.queues.female} color="text-pink-500" />
            <QueueBox label="Other" count={stats.queues.other} color="text-purple-500" />
          </div>
        </div>

        {/* User Management Section */}
        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Users size={20} className="text-yellow-500" />
            User Management
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">
                  <th className="pb-4 px-4">User</th>
                  <th className="pb-4 px-4">Status</th>
                  <th className="pb-4 px-4">Origin</th>
                  <th className="pb-4 px-4">Tier</th>
                  <th className="pb-4 px-4 text-right">Admin Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.users.map((u) => (
                  <tr key={u.socketId} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <UserIcon size={14} className="text-zinc-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{u.username}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{u.userId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        u.partnerId 
                          ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                          : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                      }`}>
                        {u.partnerId ? 'Chatting' : 'Searching'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-zinc-400">
                      {u.country}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`text-[10px] font-bold uppercase ${u.tier === 'premium' ? 'text-yellow-500' : 'text-zinc-500'}`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleToggleAdmin(u.userId, u.is_admin)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-tighter uppercase transition-all border ${
                          u.is_admin 
                            ? 'bg-yellow-500 border-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                            : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white hover:border-white/20'
                        }`}
                      >
                        <ShieldCheck size={12} />
                        {u.is_admin ? 'ADMIN ENABLED' : 'GRANT ACCESS'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.users.length === 0 && (
              <div className="py-12 text-center text-zinc-600 italic">
                No active users found to manage
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue: string }) {
  return (
    <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 backdrop-blur-xl group hover:border-white/10 transition-all">
      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-white mb-1 tracking-tight">{value}</p>
      <p className="text-[10px] text-zinc-600 font-medium">{subValue}</p>
    </div>
  );
}

function QueueBox({ label, count, color }: { label: string, count: number, color: string }) {
  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-center">
      <p className="text-xs font-bold text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{count}</p>
    </div>
  );
}
