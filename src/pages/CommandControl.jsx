import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue, update, get, push } from 'firebase/database'
import { AlertTriangle, Megaphone, Radio } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatZAR } from '@/lib/utils'
import { logAdminAction } from '@/lib/activity'

function normalizeWalletValue(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'object') {
    return Number(value.balance ?? value.amount ?? value.total ?? 0) || 0
  }
  return Number(value) || 0
}

export default function CommandControl() {
  const [disputes, setDisputes] = useState(null)
  const [message, setMessage] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'disputes'), (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...(item || {}) }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setDisputes(list)
    })

    return () => unsubscribe()
  }, [])

  const resolvedDisputes = useMemo(() => {
    if (!disputes) return []
    return disputes.filter((item) => String(item.status || '').toLowerCase() !== 'resolved')
  }, [disputes])

  const addRefundToClientWallet = async (userId, amount) => {
    if (!userId || !amount) return

    const walletRef = ref(db, `wallets/${userId}`)
    const walletSnap = await get(walletRef)
    const currentBalance = normalizeWalletValue(walletSnap.val())
    const nextBalance = currentBalance + Number(amount)

    await update(walletRef, {
      balance: nextBalance,
      lastUpdated: Date.now(),
      lastAction: 'client_refund',
    })

    const userWalletRef = ref(db, `users/${userId}/walletBalance`)
    const userWalletSnap = await get(userWalletRef)
    const currentUserBalance = normalizeWalletValue(userWalletSnap.val())
    await update(userWalletRef, {
      ...((userWalletSnap.exists() && typeof userWalletSnap.val() === 'object') ? userWalletSnap.val() : {}),
      balance: currentUserBalance + Number(amount),
      updatedAt: Date.now(),
    })
  }

  const handleDisputeAction = async (dispute, action) => {
    if (!dispute) return

    const bookingId = dispute.bookingId || dispute.booking_id || dispute.id || dispute.booking?.id
    const userId = dispute.userId || dispute.clientId || dispute.customerId || dispute.uid || dispute.reportedUserId
    const amount = Number(dispute.amount ?? dispute.totalAmount ?? 0) || 0

    try {
      if (action === 'release') {
        await update(ref(db, `bookings/${bookingId}`), {
          status: 'completed',
          disputeResolvedAt: Date.now(),
          disputeStatus: 'resolved',
        })

        await logAdminAction({
          type: 'DISPUTE_RESOLVED',
          message: `Released payment for booking ${bookingId} to pro`,
          entityId: bookingId,
        })
      }

      if (action === 'refund') {
        await update(ref(db, `bookings/${bookingId}`), {
          status: 'cancelled',
          disputeResolvedAt: Date.now(),
          disputeStatus: 'refunded',
        })

        await addRefundToClientWallet(userId, amount)

        await logAdminAction({
          type: 'CLIENT_REFUND',
          message: `Refunded client for booking ${bookingId} (${formatZAR(amount)})`,
          entityId: bookingId,
        })
      }

      await update(ref(db, `disputes/${dispute.id || bookingId}`), {
        status: 'resolved',
        resolvedAt: Date.now(),
        resolvedBy: 'admin',
      })
    } catch (error) {
      console.error('Failed to process dispute action:', error)
    }
  }

  const handleBroadcast = async () => {
    const trimmed = message.trim()
    if (!trimmed) return

    setBroadcasting(true)
    try {
      await push(ref(db, 'broadcasts'), {
        message: trimmed,
        timestamp: Date.now(),
      })
      setMessage('')
      await logAdminAction({
        type: 'BROADCAST_SENT',
        message: `Sent system broadcast: ${trimmed}`,
        entityId: 'broadcasts',
      })
    } catch (error) {
      console.error('Failed to send broadcast:', error)
    } finally {
      setBroadcasting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-destructive" />
            <p className="text-sm font-semibold text-foreground">Dispute Resolution Center</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {disputes === null && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-border px-4 py-3 last:border-b-0">
              <Skeleton className="h-10 w-full" />
            </div>
          ))}

          {disputes !== null && resolvedDisputes.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No unresolved disputes waiting for admin review.
            </div>
          )}

          {resolvedDisputes.map((dispute) => (
            <div key={dispute.id || dispute.bookingId || `${dispute.timestamp}-dispute`} className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">
                  Booking ID: {dispute.bookingId || dispute.booking_id || dispute.id || '—'}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {dispute.reason || dispute.message || 'No reason provided.'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {dispute.timestamp ? formatDate(dispute.timestamp) : '—'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleDisputeAction(dispute, 'release')}>
                  Release Payment to Pro
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDisputeAction(dispute, 'refund')}>
                  Refund Client
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Global Broadcast Tool</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type a message to send to all users…"
              className="flex-1"
            />
            <Button onClick={handleBroadcast} disabled={broadcasting || !message.trim()}>
              <Megaphone size={14} className="mr-2" />
              {broadcasting ? 'Sending...' : 'Send to All Users'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Broadcasts are saved to the /broadcasts node in Firebase as {`{ message, timestamp }`}.</p>
        </CardContent>
      </Card>
    </div>
  )
}
