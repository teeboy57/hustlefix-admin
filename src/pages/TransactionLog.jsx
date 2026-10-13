import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ref, onValue, update } from 'firebase/database'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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
import { downloadCsv } from '@/lib/export'
import { getFinancialType, getPaymentStatus, getQuoteAmount, getBookingFeeAmount } from '@/lib/finance'

const statusVariant = {
  completed: 'success',
  paid: 'success',
  confirmed: 'default',
  quoted: 'warning',
  in_progress: 'default',
  'in-progress': 'default',
  pending: 'warning',
  cancelled: 'destructive',
  failed: 'destructive',
  refunded: 'secondary',
}

function isPaymentMade(booking) {
  return ['PAID', 'SETTLED'].includes(getPaymentStatus(booking))
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
      const bookingStatus = String(b.status || '').toLowerCase().replace(/-/g, '_')

      if (statusFilter === 'all') {
        matchesStatus = true
      } else if (statusFilter === 'pending_payout') {
        matchesStatus = isReadyForPayout(b)
      } else if (statusFilter === 'approved_payout') {
        matchesStatus = isPayoutReleased(b)
      } else {
        matchesStatus = bookingStatus === statusFilter.replace(/-/g, '_')
      }

      return matchesSearch && matchesStatus
    })
  }, [bookings, search, statusFilter])

  const totalRevenue = useMemo(() => {
    if (!bookings) return 0
    return bookings
      .filter((b) => ['completed', 'paid'].includes(String(b.status).toLowerCase()))
      .reduce((sum, b) => sum + (
        getFinancialType(b) === 'Quote settlement'
          ? getQuoteAmount(b) || (Number(b.amount) || 0)
          : getBookingFeeAmount(b) || (Number(b.amount) || 0)
      ), 0)
  }, [bookings])

  const pendingPayoutValue = useMemo(() => {
    if (!bookings) return 0
    return bookings
      .filter(isReadyForPayout)
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  }, [bookings])

  const totalWorkerPayout = totalRevenue

  const exportRows = () => filtered.map((b) => {
    const type = getFinancialType(b)
    const bookingFee = getBookingFeeAmount(b)
    const quoteAmount = getQuoteAmount(b)
    return [
      b.id || 'N/A',
      type,
      b.clientName || 'Unknown',
      b.workerName || 'Unknown',
      formatZAR(bookingFee || (type === 'Direct booking fee' ? Number(b.amount) || 0 : 0)),
      formatZAR(quoteAmount || (type === 'Quote settlement' ? Number(b.amount) || 0 : 0)),
      b.status || 'Unknown',
      getPaymentStatus(b),
      b.completionCode || b.completionOTP || 'N/A',
      b.createdAt || b.timestamp ? new Date(b.createdAt || b.timestamp).toLocaleString() : 'N/A',
    ]
  })

  const exportHeaders = [
    'Transaction ID', 'Financial Type', 'Client', 'Worker', 'Booking Fee (ZAR)',
    'Quote Settlement (ZAR)', 'Job Status', 'Payment Status', 'Completion Code', 'Date',
  ]

  const exportCsv = () => {
    if (!filtered.length) return
    downloadCsv('hustlefix-transactions.csv', exportHeaders, exportRows())
    logAdminAction({ type: 'export_transactions', message: `Exported ${filtered.length} transactions as CSV`, entityId: 'transactions' })
  }

  const exportPdf = () => {
    if (!filtered.length) return

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16)
    doc.text('HustleFix Transactions Report', 14, 18)

    autoTable(doc, {
      head: [exportHeaders],
      body: exportRows(),
      startY: 26,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [13, 90, 88], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 10, right: 10 },
    })

    doc.save('hustlefix-transactions.pdf')
    logAdminAction({ type: 'export_transactions', message: `Exported ${filtered.length} transactions as PDF`, entityId: 'transactions' })
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

      if (!['PAID', 'SETTLED'].includes(getPaymentStatus(booking))) {
        setActionError('This payout cannot be approved until paymentStatus is PAID or SETTLED.')
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
            {bookings ? `${filtered.length} of ${bookings.length}` : '—'} · Processed transaction value {formatZAR(totalRevenue)} · Pending payouts {formatZAR(pendingPayoutValue)} · Worker payouts {formatZAR(totalWorkerPayout)}
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
            {['all', 'pending', 'confirmed', 'quoted', 'in_progress', 'completed', 'cancelled', 'pending_payout', 'approved_payout'].map((s) => (
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
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <ArrowDownToLine size={14} /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <ArrowDownToLine size={14} /> Export CSV
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
                <TableHead>Financial Type / Amount</TableHead>
                <TableHead>Job / Payment Status</TableHead>
                <TableHead>Completion Code</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings === null &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {bookings !== null && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
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
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline">{getFinancialType(b)}</Badge>
                      {getFinancialType(b) === 'Quote settlement' ? (
                        <p className="text-xs text-foreground">Quote: {formatZAR(getQuoteAmount(b) || b.amount)}</p>
                      ) : (
                        <p className="text-xs text-foreground">Booking fee: {formatZAR(getBookingFeeAmount(b) || b.amount)}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-2">
                      <Badge variant={statusVariant[String(b.status || 'pending').toLowerCase()] || 'secondary'} className="capitalize">
                        Job: {String(b.status || 'pending').replace(/[_-]/g, ' ')}
                      </Badge>
                      <Badge variant={getPaymentStatus(b) === 'SETTLED' || getPaymentStatus(b) === 'PAID' ? 'success' : getPaymentStatus(b) === 'REFUNDED' ? 'secondary' : 'warning'}>
                        {getPaymentStatus(b)}
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
                  <TableCell className="font-mono text-sm text-foreground">{b.completionCode || b.completionOTP || '—'}</TableCell>
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
