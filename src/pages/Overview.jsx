import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ref, onValue } from 'firebase/database'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Users, Briefcase, Banknote, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatZAR } from '@/lib/utils'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

function StatCard({ label, value, icon: Icon, delta, deltaPositive, loading, accent }) {
  return (
    <motion.div variants={item}>
      <Card className="transition-shadow hover:shadow-popover">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              {loading ? (
                <Skeleton className="mt-2 h-7 w-24" />
              ) : (
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
              )}
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
              <Icon size={16} />
            </div>
          </div>
          {delta !== undefined && !loading && (
            <div className="mt-3 flex items-center gap-1 text-xs">
              {deltaPositive ? (
                <ArrowUpRight size={13} className="text-success" />
              ) : (
                <ArrowDownRight size={13} className="text-destructive" />
              )}
              <span className={deltaPositive ? 'text-success font-medium' : 'text-destructive font-medium'}>
                {delta}
              </span>
              <span className="text-muted-foreground">vs last 30 days</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function Overview() {
  const [users, setUsers] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [emergencies, setEmergencies] = useState(null)

  useEffect(() => {
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}))
    const unsubJobs = onValue(ref(db, 'jobs'), (snap) => setJobs(snap.val() || {}))
    const unsubBookings = onValue(ref(db, 'bookings'), (snap) => setBookings(snap.val() || {}))
    const unsubEmergencies = onValue(ref(db, 'emergency_requests'), (snap) => setEmergencies(snap.val() || {}))
    return () => {
      unsubUsers()
      unsubJobs()
      unsubBookings()
      unsubEmergencies()
    }
  }, [])

  const loading = users === null || jobs === null || bookings === null

  const stats = useMemo(() => {
    if (loading) return null

    const userList = Object.values(users)
    const jobList = Object.values(jobs)
    const bookingList = Object.values(bookings)
    const emergencyList = Object.values(emergencies || {})

    const totalUsers = userList.length
    const activeJobs = jobList.filter((j) =>
      ['open', 'quoted', 'in-progress', 'in_progress'].includes(String(j.status).toLowerCase())
    ).length
    const revenue = bookingList
      .filter((b) => String(b.status).toLowerCase() === 'completed' || b.paid === true)
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
    const pendingVerifications = userList.filter(
      (u) => u.role === 'worker' && (u.verificationStatus === 'pending' || (!u.verificationStatus && !u.isVerified))
    ).length
    const activeEmergencies = emergencyList.filter((e) => ['pending', 'responded'].includes(String(e.status || '').toLowerCase())).length

    return { totalUsers, activeJobs, revenue, pendingVerifications, activeEmergencies }
  }, [users, jobs, bookings, emergencies, loading])

  const recentActivity = useMemo(() => {
    if (!users || !jobs || !bookings || !emergencies) return []

    const items = []
    Object.entries(users).forEach(([uid, user]) => {
      if (user && user.createdAt) {
        items.push({
          id: `user-${uid}`,
          type: 'user',
          title: `${user.name || 'New user'} joined`,
          meta: user.email || 'User account',
          timestamp: Number(user.createdAt),
        })
      }
    })

    Object.entries(jobs).forEach(([jobId, job]) => {
      if (job && (job.createdAt || job.timestamp)) {
        items.push({
          id: `job-${jobId}`,
          type: 'job',
          title: `${job.title || 'Job'} · ${String(job.status || 'open').replace('_', ' ')}`,
          meta: job.clientName || 'Client',
          timestamp: Number(job.createdAt || job.timestamp),
        })
      }
    })

    Object.entries(emergencies).forEach(([id, item]) => {
      if (item && (item.timestamp || item.createdAt)) {
        items.push({
          id: `emergency-${id}`,
          type: 'emergency',
          title: `${item.type || 'Emergency'} · ${item.status || 'active'}`,
          meta: item.userName || 'User report',
          timestamp: Number(item.timestamp || item.createdAt),
        })
      }
    })

    Object.entries(bookings).forEach(([id, booking]) => {
      if (booking && (booking.createdAt || booking.timestamp)) {
        items.push({
          id: `booking-${id}`,
          type: 'payment',
          title: `${booking.clientName || 'Client'} paid ${formatZAR(booking.amount || 0)}`,
          meta: booking.status || 'paid',
          timestamp: Number(booking.createdAt || booking.timestamp),
        })
      }
    })

    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 6)
  }, [users, jobs, bookings, emergencies])

  const growthData = useMemo(() => {
    if (loading) return []
    const jobList = Object.values(jobs)
    const buckets = {}
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleString('en-ZA', { month: 'short' })
      buckets[key] = 0
    }

    jobList.forEach((j) => {
      const ts = j.createdAt || j.timestamp
      if (!ts) return
      const d = new Date(ts)
      const key = d.toLocaleString('en-ZA', { month: 'short' })
      if (key in buckets) buckets[key] += 1
    })

    return Object.entries(buckets).map(([month, jobs]) => ({ month, jobs }))
  }, [jobs, loading])

  return (
    <div className="space-y-6">
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers.toLocaleString()}
          icon={Users}
          accent="bg-primary/10 text-primary"
          loading={loading}
        />
        <StatCard
          label="Active Jobs"
          value={stats?.activeJobs.toLocaleString()}
          icon={Briefcase}
          accent="bg-blue-500/10 text-blue-600"
          loading={loading}
        />
        <StatCard
          label="Revenue (R)"
          value={stats ? formatZAR(stats.revenue) : undefined}
          icon={Banknote}
          accent="bg-success/10 text-success"
          loading={loading}
        />
        <StatCard
          label="Pending Verifications"
          value={stats?.pendingVerifications.toLocaleString()}
          icon={ShieldCheck}
          accent="bg-warning/15 text-warning-foreground"
          loading={loading}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.5fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Job growth</p>
              <p className="text-xs text-muted-foreground">Jobs created per month, last 6 months</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={growthData} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(243 75% 59%)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(243 75% 59%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 16% 91%)" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(220 9% 46%)' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(220 9% 46%)' }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid hsl(220 16% 91%)',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06)',
                      fontSize: 13,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="jobs"
                    stroke="hsl(243 75% 59%)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'hsl(243 75% 59%)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Recent activity</p>
                <p className="text-xs text-muted-foreground">Latest platform updates</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {loading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background text-xs font-semibold text-muted-foreground">
                      {item.type === 'job' ? 'J' : item.type === 'user' ? 'U' : item.type === 'emergency' ? 'E' : 'P'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground sm:inline-block">{new Date(item.timestamp).toLocaleDateString('en-ZA')}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
