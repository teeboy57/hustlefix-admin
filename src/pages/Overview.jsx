import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ref, onValue, update } from 'firebase/database'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Users, Briefcase, Banknote, ShieldCheck, ArrowUpRight, ArrowDownRight, Wallet, CircleDollarSign } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatZAR } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { logAdminAction } from '@/lib/activity'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

function StatCard({ label, value, icon: Icon, delta, deltaPositive, loading, accent, onClick, active }) {
  return (
    <motion.button type="button" variants={item} onClick={onClick} className="w-full text-left">
      <Card className={`transition-all duration-200 hover:shadow-popover ${active ? 'ring-2 ring-primary/30 shadow-popover' : ''}`}>
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
    </motion.button>
  )
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'object') {
    return Number(value.balance ?? value.amount ?? value.total ?? value.totalAmount ?? 0) || 0
  }
  return Number(value) || 0
}

export default function Overview() {
  const [users, setUsers] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [emergencies, setEmergencies] = useState(null)
  const [walletBalance, setWalletBalance] = useState(null)
  const [revenueRecords, setRevenueRecords] = useState(null)
  const [payoutRequests, setPayoutRequests] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState('users')

  useEffect(() => {
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}))
    const unsubJobs = onValue(ref(db, 'jobs'), (snap) => setJobs(snap.val() || {}))
    const unsubBookings = onValue(ref(db, 'bookings'), (snap) => setBookings(snap.val() || {}))
    const unsubEmergencies = onValue(ref(db, 'emergency_requests'), (snap) => setEmergencies(snap.val() || {}))
    const unsubWallet = onValue(ref(db, 'admin_wallet/balance'), (snap) => setWalletBalance(normalizeAmount(snap.val())))
    const unsubRevenue = onValue(ref(db, 'admin_revenue'), (snap) => {
      const data = snap.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...(item || {}) }))
        .map((item) => ({
          ...item,
          totalAmount: Number(item.totalAmount ?? item.amount ?? 0) || 0,
          commission: Number(item.commission ?? ((Number(item.totalAmount ?? item.amount ?? 0) || 0) * 0.1)) || 0,
        }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setRevenueRecords(list)
    })
    const unsubPayouts = onValue(ref(db, 'withdrawal_requests'), (snap) => {
      const data = snap.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...(item || {}) }))
        .map((item) => ({
          ...item,
          amount: Number(item.amount ?? item.totalAmount ?? 0) || 0,
        }))
        .sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0))
      setPayoutRequests(list)
    })

    return () => {
      unsubUsers()
      unsubJobs()
      unsubBookings()
      unsubEmergencies()
      unsubWallet()
      unsubRevenue()
      unsubPayouts()
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

  const totalPlatformEarnings = useMemo(() => {
    if (walletBalance !== null) return walletBalance
    if (!revenueRecords) return stats?.revenue || 0
    return revenueRecords.reduce((sum, row) => sum + (Number(row.commission ?? row.totalAmount ?? 0) || 0), 0)
  }, [walletBalance, revenueRecords, stats])

  const metricDetails = useMemo(() => {
    if (!stats || !users || !jobs || !bookings) return null

    const userList = Object.values(users)
    const adminCount = userList.filter((user) => user.role === 'admin').length
    const workerCount = userList.filter((user) => user.role === 'worker').length
    const clientCount = userList.filter((user) => user.role === 'client').length
    const openJobs = Object.values(jobs).filter((job) => ['open', 'quoted', 'in-progress', 'in_progress'].includes(String(job.status || '').toLowerCase())).length
    const completedJobs = Object.values(jobs).filter((job) => String(job.status || '').toLowerCase() === 'completed').length
    const completedRevenue = Object.values(bookings).filter((booking) => ['completed', 'paid'].includes(String(booking.status || '').toLowerCase())).reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0)
    const pendingPayoutValue = Object.values(bookings).filter((booking) => ['pending', 'awaiting_payout', 'processing'].includes(String(booking.status || '').toLowerCase())).reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0)

    const detailMap = {
      users: {
        label: 'Total Users',
        subtitle: 'Everyone connected to the platform',
        items: [
          { label: 'Admins', value: adminCount.toLocaleString() },
          { label: 'Workers', value: workerCount.toLocaleString() },
          { label: 'Clients', value: clientCount.toLocaleString() },
          { label: 'Total accounts', value: userList.length.toLocaleString() },
        ],
      },
      jobs: {
        label: 'Active Jobs',
        subtitle: 'Jobs currently in motion or awaiting action',
        items: [
          { label: 'Open / quoted / active', value: openJobs.toLocaleString() },
          { label: 'Completed', value: completedJobs.toLocaleString() },
          { label: 'Pending review', value: Object.values(jobs).filter((job) => String(job.status || '').toLowerCase() === 'pending').length.toLocaleString() },
          { label: 'Disputed', value: Object.values(jobs).filter((job) => String(job.status || '').toLowerCase() === 'disputed').length.toLocaleString() },
        ],
      },
      revenue: {
        label: 'Revenue (R)',
        subtitle: 'Where the platform income is coming from',
        items: [
          { label: 'Completed bookings', value: formatZAR(completedRevenue) },
          { label: 'Admin wallet balance', value: formatZAR(totalPlatformEarnings) },
          { label: 'Pending payouts', value: formatZAR(pendingPayoutValue) },
          { label: 'Commission records', value: (revenueRecords || []).length.toLocaleString() },
        ],
      },
      verification: {
        label: 'Pending Verifications',
        subtitle: 'Workers needing approval before they can go live',
        items: [
          { label: 'Awaiting approval', value: stats.pendingVerifications.toLocaleString() },
          { label: 'Verified workers', value: userList.filter((user) => user.role === 'worker' && user.isVerified).length.toLocaleString() },
          { label: 'Unverified workers', value: userList.filter((user) => user.role === 'worker' && !user.isVerified).length.toLocaleString() },
          { label: 'Needs admin review', value: userList.filter((user) => user.role === 'worker' && (user.verificationStatus === 'pending' || (!user.verificationStatus && !user.isVerified))).length.toLocaleString() },
        ],
      },
    }

    return detailMap[selectedMetric] || detailMap.users
  }, [selectedMetric, stats, users, jobs, bookings, revenueRecords, totalPlatformEarnings])

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

  const approveWithdrawalRequest = async (request) => {
    if (!request) return
    const requestId = request.id
    const userId = request.userId || request.uid || request.customerId || 'admin'
    const requestAmount = Number(request.amount || request.totalAmount || 0) || 0

    try {
      await update(ref(db, `withdrawal_requests/${requestId}`), {
        status: 'completed',
        completedAt: Date.now(),
        completedBy: 'admin',
      })

      await update(ref(db, `transactions/${userId}/${requestId}`), {
        id: requestId,
        type: 'Withdrawal',
        amount: -Math.abs(requestAmount),
        timestamp: Date.now(),
        status: 'completed',
        description: `Withdrawal request ${requestId}`,
      })

      await logAdminAction({
        type: 'WITHDRAWAL_APPROVED',
        message: `Approved withdrawal request ${requestId} for ${formatZAR(requestAmount)}`,
        entityId: requestId,
        adminName: 'Admin',
        adminId: 'system',
      })

      setPayoutRequests((current) =>
        current
          ? current.map((item) => (item.id === requestId ? { ...item, status: 'completed' } : item))
          : current
      )
    } catch (error) {
      console.error('Failed to approve withdrawal request:', error)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-xl shadow-emerald-500/15">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Profit Overview</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white">
                {walletBalance === null ? <Skeleton className="h-9 w-32 bg-white/20" /> : formatZAR(totalPlatformEarnings)}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-emerald-50 backdrop-blur-sm">
              <Wallet size={22} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-emerald-100">
            <span>Platform earnings</span>
            <span className="font-medium text-white">
              {revenueRecords ? `${revenueRecords.length} recorded revenue items` : 'Live sync'}
            </span>
          </div>
        </CardContent>
      </Card>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers.toLocaleString()}
          icon={Users}
          accent="bg-primary/10 text-primary"
          loading={loading}
          active={selectedMetric === 'users'}
          onClick={() => setSelectedMetric('users')}
        />
        <StatCard
          label="Active Jobs"
          value={stats?.activeJobs.toLocaleString()}
          icon={Briefcase}
          accent="bg-blue-500/10 text-blue-600"
          loading={loading}
          active={selectedMetric === 'jobs'}
          onClick={() => setSelectedMetric('jobs')}
        />
        <StatCard
          label="Revenue (R)"
          value={stats ? formatZAR(stats.revenue) : undefined}
          icon={Banknote}
          accent="bg-success/10 text-success"
          loading={loading}
          active={selectedMetric === 'revenue'}
          onClick={() => setSelectedMetric('revenue')}
        />
        <StatCard
          label="Pending Verifications"
          value={stats?.pendingVerifications.toLocaleString()}
          icon={ShieldCheck}
          accent="bg-warning/15 text-warning-foreground"
          loading={loading}
          active={selectedMetric === 'verification'}
          onClick={() => setSelectedMetric('verification')}
        />
      </motion.div>

      {metricDetails && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-indigo-500/5">
          <CardContent className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{metricDetails.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{metricDetails.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMetric(selectedMetric === 'users' ? 'jobs' : selectedMetric === 'jobs' ? 'revenue' : selectedMetric === 'revenue' ? 'verification' : 'users')}
                className="rounded-md border border-primary/20 bg-white px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
              >
                View next metric
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricDetails.items.map((detail) => (
                <div key={detail.label} className="rounded-xl border border-border bg-white/70 p-3 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{detail.label}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{detail.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Revenue History</p>
                <p className="text-xs text-muted-foreground">Live from /admin_revenue</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Total Job Amount</TableHead>
                  <TableHead>10% Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueRecords === null && Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))}

                {revenueRecords !== null && revenueRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No revenue records yet.</TableCell>
                  </TableRow>
                )}

                {revenueRecords?.map((row) => (
                  <TableRow key={row.id || row.bookingId || `${row.timestamp}-${Math.random()}`}>
                    <TableCell className="text-sm text-muted-foreground">{row.timestamp ? new Date(row.timestamp).toLocaleString('en-ZA') : '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground">{row.bookingId || row.id || '—'}</TableCell>
                    <TableCell className="font-medium text-foreground">{formatZAR(row.totalAmount ?? row.amount ?? 0)}</TableCell>
                    <TableCell className="font-medium text-success">{formatZAR(row.commission ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-semibold text-foreground">Payout Request List</p>
              <p className="text-xs text-muted-foreground">Live from /withdrawal_requests</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-0">
            {payoutRequests === null && Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="border-b border-border px-4 py-3 last:border-b-0">
                <Skeleton className="h-10 w-full" />
              </div>
            ))}

            {payoutRequests !== null && payoutRequests.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No withdrawal requests.</div>
            )}

            {payoutRequests?.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{request.userName || request.userId || request.uid || request.id}</p>
                  <p className="text-[11px] text-muted-foreground">{formatZAR(request.amount || 0)} · {request.status || 'pending'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={String(request.status || 'pending').toLowerCase() === 'completed' ? 'success' : 'warning'} className="capitalize">
                    {request.status || 'pending'}
                  </Badge>
                  {String(request.status || '').toLowerCase() !== 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => approveWithdrawalRequest(request)} className="gap-1.5">
                      <CircleDollarSign size={13} /> Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
