import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ref, onValue, update } from 'firebase/database'
import { Search, MapPin, Clock, Check, X, ArrowRight } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatZAR, timeAgo, formatDate } from '@/lib/utils'
import { logAdminAction } from '@/lib/activity'

const statusConfig = {
  open: { label: 'Open', variant: 'secondary' },
  quoted: { label: 'Quoted', variant: 'warning' },
  'in-progress': { label: 'In Progress', variant: 'default' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

const statusTabs = ['all', 'open', 'quoted', 'in-progress', 'completed']

export default function JobOversight() {
  const [jobs, setJobs] = useState(null)
  const [bookings, setBookings] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState(null)
  const [actionError, setActionError] = useState(null)

  const updateJobStatus = async (jobId, nextStatus, reason) => {
    setActionError(null)
    try {
      if (String(nextStatus).toLowerCase() === 'completed') {
        const matchingBooking = bookings.find((booking) =>
          String(booking.jobId || booking.serviceId || booking.id) === String(jobId)
          || String(booking.bookingId || booking.id) === String(jobId)
        )

        if (matchingBooking && String(matchingBooking.paymentStatus || '').toUpperCase() !== 'PAID') {
          setActionError('This job can only be marked complete after paymentStatus is PAID.')
          return
        }
      }

      await update(ref(db, `jobs/${jobId}`), { status: nextStatus })
      await logAdminAction({ type: 'job_status_updated', message: `Updated job ${jobId} to ${nextStatus}${reason ? ` (${reason})` : ''}`, entityId: jobId })
    } catch (err) {
      console.error('Failed to update job status:', err)
      setActionError('The job update failed. Check your connection and try again.')
    }
  }

  useEffect(() => {
    const jobsRef = ref(db, 'jobs')
    const bookingsRef = ref(db, 'bookings')

    const unsubscribeJobs = onValue(jobsRef, (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data).map(([id, j]) => ({ id, ...j }))
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      setJobs(list)
    })

    const unsubscribeBookings = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data).map(([id, b]) => ({ id, ...b }))
      setBookings(list)
    })

    return () => {
      unsubscribeJobs()
      unsubscribeBookings()
    }
  }, [])

  const filtered = useMemo(() => {
    if (!jobs) return []
    return jobs.filter((j) => {
      const status = String(j.status || '').toLowerCase()
      const matchesStatus = statusFilter === 'all' || status === statusFilter || status.replace('_', '-') === statusFilter
      const matchesSearch =
        !search ||
        j.title?.toLowerCase().includes(search.toLowerCase()) ||
        j.category?.toLowerCase().includes(search.toLowerCase()) ||
        j.clientName?.toLowerCase().includes(search.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [jobs, search, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">All jobs</p>
          <p className="text-xs text-muted-foreground">
            {jobs ? `${filtered.length} of ${jobs.length}` : '—'} jobs
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search jobs, category, client…"
              className="w-64 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5">
            {statusTabs.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {jobs === null ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No jobs match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job, idx) => {
            const status = String(job.status || 'open').toLowerCase()
            const config = statusConfig[status] || statusConfig.open
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
              >
                <Card className="h-full transition-shadow hover:shadow-popover">
                  <CardContent className="flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {job.title || 'Untitled job'}
                      </p>
                      <Badge variant={config.variant} className="shrink-0">{config.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{job.category || 'General'}</p>

                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      {job.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} /> <span>{job.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} /> <span>{timeAgo(job.createdAt)}</span>
                      </div>
                    </div>

                    <div className="mt-auto space-y-3 pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Client</p>
                          <p className="text-xs font-medium text-foreground">{job.clientName || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Quoted</p>
                          <p className="text-sm font-semibold text-foreground">
                            {job.quotedAmount ? formatZAR(job.quotedAmount) : '—'}
                          </p>
                        </div>
                      </div>

                      {['open', 'quoted', 'in-progress', 'in_progress'].includes(status) && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedJob(job)}>
                            View details
                          </Button>
                          {['open', 'quoted'].includes(status) && (
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => updateJobStatus(job.id, 'in-progress', 'admin action')}>
                              <ArrowRight size={14} /> Advance
                            </Button>
                          )}
                          {['in-progress', 'in_progress'].includes(status) && (
                            <Button variant="secondary" size="sm" className="flex-1" onClick={() => updateJobStatus(job.id, 'completed', 'completed by admin')}>
                              <Check size={14} /> Complete
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="px-2 text-destructive hover:text-destructive" onClick={() => updateJobStatus(job.id, 'cancelled', 'cancelled by admin')}>
                            <X size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedJob?.title || 'Job details'}</DialogTitle>
            <DialogDescription>Operational summary for this job.</DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
                <div>
                  <p className="text-base font-semibold text-foreground">{selectedJob.title || 'Untitled job'}</p>
                  <p className="text-sm text-muted-foreground">{selectedJob.category || 'General service'}</p>
                </div>
                <Badge variant={statusConfig[String(selectedJob.status || 'open').toLowerCase()]?.variant || 'secondary'}>
                  {statusConfig[String(selectedJob.status || 'open').toLowerCase()]?.label || 'Open'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="mt-1 font-medium text-foreground">{selectedJob.clientName || '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Quoted</p>
                  <p className="mt-1 font-medium text-foreground">{selectedJob.quotedAmount ? formatZAR(selectedJob.quotedAmount) : '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="mt-1 font-medium text-foreground">{selectedJob.location || '—'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="mt-1 font-medium text-foreground">{formatDate(selectedJob.createdAt || selectedJob.timestamp)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-3 text-sm">
                <p className="text-xs text-muted-foreground">Job ID</p>
                <p className="mt-1 font-mono text-xs text-foreground">{selectedJob.id}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {['open', 'quoted'].includes(String(selectedJob.status || '').toLowerCase()) && (
                  <Button size="sm" onClick={() => {
                    setSelectedJob(null)
                    updateJobStatus(selectedJob.id, 'in-progress', 'admin action')
                  }}>
                    Advance to in-progress
                  </Button>
                )}
                {['in-progress', 'in_progress'].includes(String(selectedJob.status || '').toLowerCase()) && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    setSelectedJob(null)
                    updateJobStatus(selectedJob.id, 'completed', 'completed by admin')
                  }}>
                    Mark complete
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => {
                  setSelectedJob(null)
                  updateJobStatus(selectedJob.id, 'cancelled', 'cancelled by admin')
                }}>
                  Cancel job
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
