import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { AlertTriangle, BarChart3, Download, TrendingUp, Users, Briefcase, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatZAR } from '@/lib/utils'

const normalizeStatus = (value) => String(value || 'pending').trim().toLowerCase()
const DEFAULT_SUSPENSION_MS = 7 * 24 * 60 * 60 * 1000

export default function Reports() {
  const [users, setUsers] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [reports, setReports] = useState([])
  const [disputes, setDisputes] = useState({})
  const [actioningId, setActioningId] = useState(null)

  useEffect(() => {
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}))
    const unsubJobs = onValue(ref(db, 'jobs'), (snap) => setJobs(snap.val() || {}))
    const unsubBookings = onValue(ref(db, 'bookings'), (snap) => setBookings(snap.val() || {}))
    const unsubReports = onValue(ref(db, 'reports'), (snap) => {
      const data = snap.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...(item || {}) }))
        .filter((item) => item && typeof item === 'object')
      list.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
      setReports(list)
    })
    const unsubDisputes = onValue(ref(db, 'disputes'), (snap) => {
      const data = snap.val() || {}
      setDisputes(data)
    })

    return () => {
      unsubUsers()
      unsubJobs()
      unsubBookings()
      unsubReports()
      unsubDisputes()
    }
  }, [])

  const metrics = useMemo(() => {
    if (!users || !jobs || !bookings) return null

    const userList = Object.values(users)
    const jobList = Object.values(jobs)
    const bookingList = Object.values(bookings)

    const workers = userList.filter((user) => user.role === 'worker').length
    const verifiedWorkers = userList.filter((user) => user.role === 'worker' && user.isVerified).length
    const completedJobs = jobList.filter((job) => String(job.status).toLowerCase() === 'completed').length
    const revenue = bookingList
      .filter((booking) => ['completed', 'paid'].includes(String(booking.status).toLowerCase()))
      .reduce((sum, booking) => sum + Number(booking.amount || 0), 0)

    return {
      workers,
      verifiedWorkers,
      completedJobs,
      revenue,
      activeJobs: jobList.filter((job) => ['open', 'quoted', 'in-progress', 'in_progress'].includes(String(job.status).toLowerCase())).length,
      suspendedUsers: userList.filter((user) => user.isSuspended).length,
      pendingReports: reports.filter((report) => normalizeStatus(report.status) === 'pending').length,
      totalReports: reports.length,
    }
  }, [users, jobs, bookings, reports])

  const exportSummary = () => {
    if (!metrics) return
    const csv = [
      ['Metric', 'Value'],
      ['Users', Object.keys(users || {}).length],
      ['Workers', metrics.workers],
      ['Verified Workers', metrics.verifiedWorkers],
      ['Active Jobs', metrics.activeJobs],
      ['Completed Jobs', metrics.completedJobs],
      ['Revenue', metrics.revenue],
      ['Suspended Users', metrics.suspendedUsers],
      ['Pending Reports', metrics.pendingReports],
      ['Total Reports', metrics.totalReports],
    ]
      .map((row) => row.map((value) => `"${value}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hustlefix-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const getUserDisplay = (uid) => {
    if (!uid || !users) return uid || 'Unknown user'
    const user = users[uid]
    if (!user) return uid
    return user.name || user.email || uid
  }

  const getDisputeForReport = (report) => {
    if (!report) return null
    const direct = disputes?.[report.id]
    if (direct) return direct

    const byReportId = disputes?.[report.reportId]
    if (byReportId) return byReportId

    const chatKey = `${report.reporterId}_${report.reportedUserId}`
    const byChatKey = disputes?.[chatKey]
    if (byChatKey) return byChatKey

    const reverseChatKey = `${report.reportedUserId}_${report.reporterId}`
    return disputes?.[reverseChatKey] || null
  }

  const handleSuspendUser = async (report) => {
    if (!report?.reportedUserId) return

    setActioningId(report.id)
    try {
      const suspensionUntil = Date.now() + DEFAULT_SUSPENSION_MS
      await update(ref(db, `users/${report.reportedUserId}`), {
        isSuspended: true,
        suspensionUntil,
      })
      await update(ref(db, `reports/${report.id}`), {
        status: 'reviewed',
        reviewedByAdmin: 'dashboard',
        reviewedAt: Date.now(),
        action: 'suspended',
        suspensionUntil,
      })
    } catch (error) {
      console.error('Failed to suspend reported user:', error)
    } finally {
      setActioningId(null)
    }
  }

  const handleUpdateStatus = async (reportId, status) => {
    setActioningId(reportId)
    try {
      await update(ref(db, `reports/${reportId}`), {
        status,
        reviewedByAdmin: 'dashboard',
        reviewedAt: Date.now(),
      })
    } catch (error) {
      console.error('Failed to update report status:', error)
    } finally {
      setActioningId(null)
    }
  }

  const handleClearFlags = async (report) => {
    if (!report?.reportedUserId) return

    setActioningId(report.id)
    try {
      await update(ref(db, `users/${report.reportedUserId}`), {
        isSuspended: false,
        suspensionUntil: null,
      })
      await update(ref(db, `reports/${report.id}`), {
        status: 'cleared',
        reviewedByAdmin: 'dashboard',
        reviewedAt: Date.now(),
        action: 'cleared',
      })
    } catch (error) {
      console.error('Failed to clear report flags:', error)
    } finally {
      setActioningId(null)
    }
  }

  const pendingReports = useMemo(
    () => reports.filter((report) => normalizeStatus(report.status) === 'pending'),
    [reports],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 size={15} className="text-primary" /> Reports
          </p>
          <p className="text-xs text-muted-foreground">Operational summary, platform health, and reported users</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportSummary} disabled={!metrics}>
          <Download size={14} /> Export summary
        </Button>
      </div>

      {metrics === null ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-muted-foreground">Workers</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-foreground">{metrics.workers}</p>
                <p className="text-xs text-muted-foreground">Total workers</p>
              </div>
              <Users className="text-primary" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-muted-foreground">Verified workers</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-foreground">{metrics.verifiedWorkers}</p>
                <p className="text-xs text-muted-foreground">Trust score</p>
              </div>
              <TrendingUp className="text-success" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-muted-foreground">Completed jobs</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-foreground">{metrics.completedJobs}</p>
                <p className="text-xs text-muted-foreground">Jobs delivered</p>
              </div>
              <Briefcase className="text-blue-600" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <p className="text-xs font-medium text-muted-foreground">Revenue</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-foreground">{formatZAR(metrics.revenue)}</p>
                <p className="text-xs text-muted-foreground">Collected</p>
              </div>
              <TrendingUp className="text-success" />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              <p className="text-sm font-semibold text-foreground">Reported users queue</p>
            </div>
            <Badge variant="destructive">{pendingReports.length} pending</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-0 px-4 pb-4">
          {reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No reports received yet.
            </div>
          ) : (
            pendingReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
                There are no pending reports at the moment.
              </div>
            ) : (
              pendingReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="destructive">{normalizeStatus(report.status)}</Badge>
                        <span className="text-xs text-muted-foreground">{report.reportType || report.category || 'General report'}</span>
                      </div>

                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reporter</p>
                          <p className="font-medium text-foreground">{getUserDisplay(report.reporterId)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reported user</p>
                          <p className="font-medium text-foreground">{getUserDisplay(report.reportedUserId)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Report</p>
                        <p className="mt-1 text-sm text-foreground">{report.description || report.reason || 'No description provided.'}</p>
                      </div>

                      {(() => {
                        const dispute = getDisputeForReport(report)
                        return dispute ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                            <p className="text-[11px] uppercase tracking-wide text-amber-900/80">Dispute / defense</p>
                            <p className="mt-1 text-foreground">{dispute.description || dispute.reason || dispute.message || 'The accused user submitted a defense statement.'}</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
                            No dispute statement recorded for this report yet.
                          </div>
                        )
                      })()}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(report.timestamp)}</span>
                        {report.reporterId && report.reportedUserId && (
                          <span className="font-mono">Chat: {String(report.reporterId).localeCompare(String(report.reportedUserId)) < 0 ? `${report.reporterId}_${report.reportedUserId}` : `${report.reportedUserId}_${report.reporterId}`}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:min-w-[190px]">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleSuspendUser(report)}
                        disabled={actioningId === report.id}
                      >
                        <ShieldAlert size={14} />
                        {actioningId === report.id ? 'Updating...' : 'Suspend user'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleClearFlags(report)}
                        disabled={actioningId === report.id}
                      >
                        <CheckCircle2 size={14} />
                        Clear flags
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                        disabled={actioningId === report.id}
                      >
                        Mark reviewed
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
