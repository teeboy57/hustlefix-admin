import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ref, onValue, update } from 'firebase/database'
import { Siren, MapPin, Phone, CheckCircle2, Volume2, VolumeX, User, Search } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { timeAgo } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

function playAlertTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    const beep = (start, freq) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.28)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.3)
    }
    beep(0, 880)
    beep(0.32, 880)
  } catch (err) {
    console.warn('Audio alert unavailable:', err)
  }
}

export default function EmergencyHub() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const knownIds = useRef(new Set())
  const isFirstLoad = useRef(true)

  useEffect(() => {
    const emergencyRef = ref(db, 'emergency_requests')
    const unsubscribe = onValue(emergencyRef, (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data).map(([id, r]) => ({ id, ...r }))
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

      const pendingNow = list.filter((r) => String(r.status || '').toLowerCase() === 'pending')

      if (!isFirstLoad.current) {
        const newPending = pendingNow.filter((r) => !knownIds.current.has(r.id))
        if (newPending.length > 0 && soundEnabled) {
          playAlertTone()
        }
      }

      knownIds.current = new Set(pendingNow.map((r) => r.id))
      isFirstLoad.current = false
      setRequests(list)
    })
    return () => unsubscribe()
  }, [soundEnabled])

  const filteredRequests = useMemo(() => {
    if (!requests) return []
    return requests.filter((r) => {
      const status = String(r.status || '').toLowerCase()
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      const matchesSearch =
        !search ||
        (r.userName || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.type || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.location || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.phone || '').toLowerCase().includes(search.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [requests, search, statusFilter])

  const assistRequest = async (id) => {
    try {
      await update(ref(db, `emergency_requests/${id}`), {
        status: 'responded',
        responderId: profile?.uid || 'admin',
        responderName: profile?.name || profile?.email || 'Admin',
        respondedAt: Date.now(),
      })
    } catch (err) {
      console.error('Failed to assist emergency request:', err)
    }
  }

  const resolveRequest = async (id) => {
    try {
      await update(ref(db, `emergency_requests/${id}`), {
        status: 'resolved',
        resolvedAt: Date.now(),
      })
    } catch (err) {
      console.error('Failed to resolve emergency request:', err)
    }
  }

  const openRequests = (requests || []).filter((r) => ['pending', 'responded'].includes(String(r.status || '').toLowerCase()))
  const resolvedRequests = (requests || []).filter((r) => String(r.status || '').toLowerCase() === 'resolved')

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {requests !== null && openRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-4"
          >
            <div className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-destructive/30 bg-destructive px-4 py-3 text-destructive-foreground shadow-popover emergency-glow">
              <Siren size={18} className="shrink-0 animate-pulse" />
              <p className="flex-1 text-sm font-medium">
                {openRequests.length} emergency request{openRequests.length > 1 ? 's' : ''} need attention
              </p>
              <button
                onClick={() => setSoundEnabled((s) => !s)}
                className="rounded-md p-1.5 hover:bg-white/15"
                title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Siren size={16} className="text-destructive" /> Emergency queue
          </p>
          <p className="text-xs text-muted-foreground">Live from /emergency_requests · pending requests trigger the alert</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, type, location…"
              className="w-64 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5">
            {['all', 'pending', 'responded', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setSoundEnabled((s) => !s)}>
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {soundEnabled ? 'Sound on' : 'Sound off'}
          </Button>
        </div>
      </div>

      {requests === null ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredRequests.filter((r) => ['pending', 'responded'].includes(String(r.status || '').toLowerCase())).length === 0 && statusFilter !== 'resolved' ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <CheckCircle2 size={28} className="text-success" />
            <p className="text-sm font-medium text-foreground">No active emergencies</p>
            <p className="text-xs text-muted-foreground">The team will be alerted the instant a new pending request arrives.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnimatePresence>
            {filteredRequests.filter((r) => ['pending', 'responded'].includes(String(r.status || '').toLowerCase())).map((r) => {
              const status = String(r.status || '').toLowerCase()
              const isPending = status === 'pending'
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  layout
                >
                  <Card className={isPending ? 'border-destructive/25 bg-destructive/[0.03]' : 'border-border bg-background'}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isPending && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                            </span>
                          )}
                          <p className="text-sm font-semibold text-foreground">
                            {r.type || 'Emergency request'}
                          </p>
                        </div>
                        <Badge variant={isPending ? 'destructive' : 'secondary'} className="capitalize">{status}</Badge>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User size={12} /> <span>{r.userName || r.uid || 'Unknown user'}</span>
                        </div>
                        {r.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone size={12} /> <span>{r.phone}</span>
                          </div>
                        )}
                        {r.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} /> <span>{r.location}</span>
                          </div>
                        )}
                        <p>{timeAgo(r.timestamp)}</p>
                      </div>

                      {r.message && (
                        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-foreground border border-border">
                          “{r.message}”
                        </p>
                      )}

                      <div className="mt-4 flex gap-2">
                        {isPending && (
                          <Button size="sm" className="flex-1" onClick={() => assistRequest(r.id)}>
                            Assist
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" className="flex-1" onClick={() => resolveRequest(r.id)}>
                          Resolve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {filteredRequests.filter((r) => String(r.status || '').toLowerCase() === 'resolved').length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Recently resolved</p>
          <div className="space-y-2">
            {filteredRequests.filter((r) => String(r.status || '').toLowerCase() === 'resolved').slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">{r.type || 'Emergency request'}</p>
                  <p className="text-xs text-muted-foreground">{r.userName || r.uid}</p>
                </div>
                <Badge variant="success">Resolved</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
