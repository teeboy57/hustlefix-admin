import React, { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatZAR } from '@/lib/utils'

export default function RevenueHistory() {
  const [revenue, setRevenue] = useState(null)

  useEffect(() => {
    const unsub = onValue(ref(db, 'admin_revenue'), (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({
          id,
          ...(item || {}),
          totalAmount: Number(item?.totalAmount ?? item?.amount ?? 0) || 0,
          commission: Number(item?.commission ?? ((Number(item?.totalAmount ?? item?.amount ?? 0) || 0) * 0.1)) || 0,
        }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

      setRevenue(list)
    })

    return () => unsub()
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Revenue History</p>
        <p className="text-xs text-muted-foreground">Live from /admin_revenue</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Platform earnings</p>
              <p className="text-xs text-muted-foreground">Booking totals and commission payouts</p>
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
              {revenue === null && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))}

              {revenue !== null && revenue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No revenue records available yet.
                  </TableCell>
                </TableRow>
              )}

              {revenue?.map((item) => (
                <TableRow key={item.id || item.bookingId || `${item.timestamp}-${Math.random()}`}>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.timestamp ? formatDate(item.timestamp) : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{item.bookingId || item.id || '—'}</TableCell>
                  <TableCell className="font-medium text-foreground">{formatZAR(item.totalAmount ?? 0)}</TableCell>
                  <TableCell className="font-medium text-success">{formatZAR(item.commission ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
