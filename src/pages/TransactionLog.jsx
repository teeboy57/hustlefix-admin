import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ref, onValue, update } from 'firebase/database'
import { Search, ArrowDownToLine, RefreshCcw, CircleDollarSign } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatZAR, formatDate } from '@/lib/utils'
import { logAdminAction } from '@/lib/activity'
import { sendUserNotification } from '@/lib/fcm'

const statusVariant = {
  completed: 'success',
  paid: 'success',
  pending: 'warning',
  failed: 'destructive',
  refunded: 'secondary',
}

function isPaymentMade(booking) {
  return booking.paid === true ||
    String(booking.paymentStatus || '').toLowerCase() === 'paid' ||
    String(booking.payment?.status || '').toLowerCase() === 'paid'
}

function isClientConfirmed(booking) {
  return booking.clientConfirmed === true ||
    booking.confirmedByClient === true ||
    booking.completedByClient === true ||
    booking.completionConfirmed === true
}

function isPayoutReleased(booking) {
  return booking.payoutReleased === true ||
    booking.walletCredited === true ||
    ['released', 'paid', 'approved'].includes(String(booking.payoutStatus || '').toLowerCase())
}

function isReadyForPayout(booking) {
  if (!booking) return false
  const isCompleted = String(booking.status || '').toLowerCase() === 'completed'
  return isCompleted && isPaymentMade(booking) && isClientConfirmed(booking) && !isPayoutReleased(booking)
}

export default function TransactionLog() {
  const [bookings, setBookings] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    const bookingsRef = ref(db, 'bookings')
    const unsubscribe = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data).map(([id, b]) => ({ id, ...b }))
      list.sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0))
      setBookings(list)
    })
    return () => unsubscribe()
  }, [])

  const filtered = useMemo(() => {
    if (!bookings) return []
    return bookings.filter((b) => {
      const matchesSearch =
        !search ||
        b.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        b.workerName?.toLowerCase().includes(search.toLowerCase()) ||
        b.id?.toLowerCase().includes(search.toLowerCase()) ||
        String(b.status || '').toLowerCase().includes(search.toLowerCase()) ||
        String(b.payoutStatus || '').toLowerCase().includes(search.toLowerCase())

      let matchesStatus = true
      const bookingStatus = String(b.status || '').toLowerCase()

      if (statusFilter === 'all') {
        matchesStatus = true
      } else if (statusFilter === 'pending_payout') {
        matchesStatus = isReadyForPayout(b)
      } else if (statusFilter === 'approved_payout') {
        matchesStatus = isPayoutReleased(b)
      } else {
        matchesStatus = bookingStatus === statusFilter
      }

      return matchesSearch && matchesStatus
    })
  }, [bookings, search, statusFilter])

  const totalRevenue = useMemo(() => {
    if (!bookings) return 0
    return bookings
      .filter((b) => ['completed', 'paid'].includes(String(b.status).toLowerCase()))
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  }, [bookings])

  const pendingPayoutValue = useMemo(() => {
    if (!bookings) return 0
    return bookings
      .filter(isReadyForPayout)
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  }, [bookings])

  const totalWorkerPayout = totalRevenue

  const exportCsv = () => {
    if (!filtered.length) return
    const headers = ['Transaction ID', 'Client', 'Worker', 'Amount (ZAR)', 'Status', 'Date']
    const rows = filtered.map((b) => [
      b.id,
      b.clientName || '',
      b.workerName || '',
      b.amount || 0,
      b.status || '',
      b.createdAt ? new Date(b.createdAt).toISOString() : '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hustlefix-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
    logAdminAction({ type: 'export_transactions', message: `Exported ${filtered.length} transactions`, entityId: 'transactions' })
  }

  const writeTransactionRecord = async ({ userId, bookingId, amount, serviceTTitle, type = 'Payout' }) => {
    if (!userId) return

    const transactionId = bookingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const payload = {
      id: transactionId,
      type,
      amount: Number(amount) || 0,
      timestamp: Date.now(),
      serviceTTitle: serviceTTitle || 'HustleFix job',
    }

    await update(ref(db, `transactions/${userId}/${transactionId}`), payload)
    return payload
  }

  const updateTransactionStatus = async (bookingId, status) => {
    setActionError(null)
    try {
      await update(ref(db, `bookings/${bookingId}`), { status })
      await logAdminAction({ type: 'transaction_status_updated', message: `Updated transaction ${bookingId} to ${status}`, entityId: bookingId })
    } catch (err) {
      console.error('Failed to update transaction status:', err)
      setActionError('The transaction update failed. Check your connection and try again.')
    }
  }

  const approvePayout = async (bookingId) => {
    setActionError(null)
    try {
      const booking = bookings?.find((item) => item.id === bookingId)
      if (!booking) return

      if (String(booking.paymentStatus || '').toUpperCase() !== 'PAID') {
        setActionError('This payout cannot be approved until paymentStatus is PAID.')
        return
      }

      await update(ref(db, `bookings/${bookingId}`), {
        payoutStatus: 'approved',
        payoutApprovedAt: Date.now(),
        payoutApprovedBy: 'admin',
      })

      await update(ref(db, `withdrawal_requests/${bookingId}`), {
        status: 'completed',
        completedAt: Date.now(),
        completedByAdminId: 'admin',
      })

      const userId = booking.userId || booking.clientId || booking.workerId || null
      if (userId) {
        await writeTransactionRecord({
          userId,
          bookingId,
          amount: -Math.abs(Number(booking.amount) || 0),
          serviceTTitle: booking.serviceTTitle || booking.title || 'HustleFix payout',
          type: 'Payout',
        })
      }

      await sendUserNotification({
        userId,
        title: 'Payout approved',
        body: 'Your payout has been approved and is on its way.',
        screen: 'wallet',
      })

      await logAdminAction({
        type: 'payout_approved',
        message: `Approved payout for booking ${bookingId}`,
        entityId: bookingId,
      })
    } catch (err) {
      console.error('Failed to approve payout:', err)
      setActionError('The payout approval failed. Check your connection and try again.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Transactions</p>
          <p className="text-xs text-muted-foreground">
            {bookings ? `${filtered.length} of ${bookings.length}` : '—'} · Total processed {formatZAR(totalRevenue)} · Pending payouts {formatZAR(pendingPayoutValue)} · Worker payouts {formatZAR(totalWorkerPayout)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by client, worker, ID…"
              className="w-full min-w-0 sm:w-64 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5">
            {['all', 'pending', 'completed', 'failed', 'refunded', 'pending_payout', 'approved_payout'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <ArrowDownToLine size={14} /> Export
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings === null &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {bookings !== null && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((b, idx) => (
                <motion.tr
                  key={b.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                  className="border-b border-border transition-colors hover:bg-muted/50"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">#{b.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground">{b.clientName || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground">{b.workerName || '—'}</TableCell>
                  <TableCell className="text-sm font-semibold text-foreground">{formatZAR(b.amount)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-2">
                      <Badge variant={statusVariant[String(b.status).toLowerCase()] || 'secondary'} className="capitalize">
                        {b.status || 'pending'}
                      </Badge>
                      {isReadyForPayout(b) && (
                        <Button variant="secondary" size="sm" className="h-7 px-2" onClick={() => approvePayout(b.id)}>
                          <CircleDollarSign size={12} /> Manual payout
                        </Button>
                      )}
                      {isPayoutReleased(b) && (
                        <Badge variant="success" className="capitalize">Payout approved</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(b.createdAt || b.timestamp)}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
