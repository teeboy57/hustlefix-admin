import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ArrowDownToLine } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv } from '@/lib/export'
import {
  getBookingFeeAmount,
  getFinancialType,
  getPaymentStatus,
  getQuoteAmount,
} from '@/lib/finance'
import { formatDate, formatZAR } from '@/lib/utils'

const reportHeaders = ['Date', 'Booking ID', 'Financial Type', 'Settled Amount (ZAR)', 'Platform Commission (ZAR)', 'Payment Status']

export default function RevenueHistory() {
  const [revenue, setRevenue] = useState(null)
  const [bookings, setBookings] = useState(null)

  useEffect(() => {
    const unsubRevenue = onValue(ref(db, 'admin_revenue'), (snapshot) => {
      const data = snapshot.val() || {}
      setRevenue(Object.entries(data).map(([id, item]) => ({ id, ...(item || {}) })))
    })
    const unsubBookings = onValue(ref(db, 'bookings'), (snapshot) => {
      const data = snapshot.val() || {}
      setBookings(Object.entries(data).map(([id, item]) => ({ id, ...(item || {}) })))
    })

    return () => {
      unsubRevenue()
      unsubBookings()
    }
  }, [])

  const financialRows = useMemo(() => {
    if (!revenue || !bookings) return null

    const bookingById = new Map(bookings.map((booking) => [String(booking.id), booking]))
    const directFees = bookings
      .map((booking) => {
        const financialType = getFinancialType(booking)
        const paymentStatus = getPaymentStatus(booking)
        const amount = getBookingFeeAmount(booking) ||
          (financialType === 'Direct booking fee' ? Number(booking.amount) || 0 : 0)
        if (!amount || financialType !== 'Direct booking fee' || !['PAID', 'SETTLED'].includes(paymentStatus)) return null
        return {
          id: `booking-fee-${booking.id}`,
          bookingId: booking.id,
          timestamp: booking.timestamp || booking.createdAt,
          financialType,
          totalAmount: amount,
          commission: 0,
          paymentStatus,
        }
      })
      .filter(Boolean)

    const quoteSettlements = revenue.map((entry) => {
      const booking = bookingById.get(String(entry.bookingId || entry.id))
      const entryType = getFinancialType(entry)
      const financialType = entryType === 'Unclassified' && getFinancialType(booking) !== 'Direct booking fee'
        ? 'Quote settlement'
        : entryType === 'Unclassified' ? getFinancialType(booking) : entryType
      if (financialType !== 'Quote settlement') return null

      const paymentStatus = getPaymentStatus({ ...booking, ...entry })
      if (paymentStatus === 'REFUNDED') return null
      const totalAmount = getQuoteAmount(entry) || getQuoteAmount(booking) ||
        Number(entry.totalAmount ?? entry.amount ?? 0) || 0
      const explicitPaymentStatus = entry.paymentStatus || entry.payment?.status ||
        booking?.paymentStatus || booking?.payment?.status || booking?.paid === true
      const settled = !explicitPaymentStatus || !['UNPAID', 'PENDING'].includes(paymentStatus) ||
        ['SETTLED', 'RELEASED', 'COMPLETED'].includes(String(entry.escrowStatus || entry.settlementStatus || '').toUpperCase())
      if (!settled) return null
      const storedCommission = entry.commission === undefined || entry.commission === null
        ? totalAmount * 0.1
        : Number(entry.commission) || 0

      return {
        ...entry,
        bookingId: entry.bookingId || booking?.id || entry.id,
        timestamp: entry.timestamp || booking?.timestamp || booking?.createdAt,
        financialType,
        totalAmount,
        commission: storedCommission,
        paymentStatus: paymentStatus === 'UNPAID' || paymentStatus === 'PENDING' ? 'SETTLED' : paymentStatus,
      }
    }).filter(Boolean)

    return [...directFees, ...quoteSettlements]
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
  }, [revenue, bookings])

  const totals = useMemo(() => {
    const rows = financialRows || []
    return rows.reduce((sum, row) => {
      if (row.financialType === 'Direct booking fee') sum.directFees += row.totalAmount
      if (row.financialType === 'Quote settlement') {
        sum.settledQuotes += row.totalAmount
        sum.commission += row.commission
      }
      return sum
    }, { directFees: 0, settledQuotes: 0, commission: 0 })
  }, [financialRows])

  const exportRows = () => (financialRows || []).map((row) => [
    row.timestamp ? new Date(row.timestamp).toLocaleString() : '—',
    row.bookingId || row.id || '—',
    row.financialType,
    row.totalAmount.toFixed(2),
    row.commission.toFixed(2),
    row.paymentStatus,
  ])

  const exportCsv = () => {
    if (!financialRows?.length) return
    downloadCsv('hustlefix-financial-report.csv', reportHeaders, exportRows())
  }

  const exportPdf = () => {
    if (!financialRows?.length) return
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(16)
    doc.text('HustleFix Platform Financial Report', 14, 18)
    doc.setFontSize(9)
    doc.text(`Direct booking fees: ${formatZAR(totals.directFees)}   Settled quote value: ${formatZAR(totals.settledQuotes)}   Platform commission: ${formatZAR(totals.commission)}`, 14, 24)
    autoTable(doc, {
      head: [reportHeaders],
      body: exportRows(),
      startY: 30,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [13, 90, 88], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 10, right: 10 },
    })
    doc.save('hustlefix-financial-report.pdf')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Revenue History</p>
          <p className="text-xs text-muted-foreground">Direct booking-fee transfers and settled on-site quote escrow</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={!financialRows?.length}>
            <ArrowDownToLine size={14} /> Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!financialRows?.length}>
            <ArrowDownToLine size={14} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Direct booking fees</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatZAR(totals.directFees)}</p>
          <p className="text-xs text-muted-foreground">Transferred to provider wallets; not escrow revenue</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Settled quote amounts</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatZAR(totals.settledQuotes)}</p>
          <p className="text-xs text-muted-foreground">Quote payments released from escrow</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">10% quote commission</p>
          <p className="mt-1 text-xl font-semibold text-success">{formatZAR(totals.commission)}</p>
          <p className="text-xs text-muted-foreground">Calculated only on settled quote amounts</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Platform financial activity</p>
            <p className="text-xs text-muted-foreground">Commission is read from /admin_revenue when available; otherwise calculated at 10% for settled quotes.</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Booking ID</TableHead>
                <TableHead>Financial Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>10% Commission</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialRows === null && Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))}
              {financialRows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No financial activity is available yet.
                  </TableCell>
                </TableRow>
              )}
              {financialRows?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm text-muted-foreground">{row.timestamp ? formatDate(row.timestamp) : '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{row.bookingId || row.id || '—'}</TableCell>
                  <TableCell><Badge variant={row.financialType === 'Quote settlement' ? 'default' : 'outline'}>{row.financialType}</Badge></TableCell>
                  <TableCell className="font-medium text-foreground">{formatZAR(row.totalAmount)}</TableCell>
                  <TableCell className="font-medium text-success">{formatZAR(row.commission)}</TableCell>
                  <TableCell><Badge variant={row.paymentStatus === 'PAID' || row.paymentStatus === 'SETTLED' ? 'success' : 'secondary'}>{row.paymentStatus}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
