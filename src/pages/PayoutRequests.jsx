import React, { useEffect, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { CircleDollarSign } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatZAR } from '@/lib/utils'
import { logAdminAction } from '@/lib/activity'

export default function PayoutRequests() {
  const [requests, setRequests] = useState(null)

  useEffect(() => {
    const unsub = onValue(ref(db, 'withdrawal_requests'), (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...(item || {}), amount: Number(item?.amount ?? item?.totalAmount ?? 0) || 0 }))
        .sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0))
      setRequests(list)
    })

    return () => unsub()
  }, [])

  const approveRequest = async (request) => {
    if (!request) return

    const requestId = request.id
    const userId = request.userId || request.uid || request.customerId || 'admin'
    const amount = Number(request.amount || request.totalAmount || 0) || 0

    try {
      await update(ref(db, `withdrawal_requests/${requestId}`), {
        status: 'completed',
        completedAt: Date.now(),
        completedBy: 'admin',
      })

      await update(ref(db, `transactions/${userId}/${requestId}`), {
        id: requestId,
        type: 'Withdrawal',
        amount: -Math.abs(amount),
        timestamp: Date.now(),
        status: 'completed',
        description: `Withdrawal request ${requestId}`,
      })

      await logAdminAction({
        type: 'WITHDRAWAL_APPROVED',
        message: `Approved withdrawal request ${requestId} for ${formatZAR(amount)}`,
        entityId: requestId,
        adminName: 'Admin',
        adminId: 'system',
      })
    } catch (error) {
      console.error('Failed to approve withdrawal request:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Payout Requests</p>
        <p className="text-xs text-muted-foreground">Review and approve platform withdrawals</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CircleDollarSign size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Withdrawal queue</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          {requests === null && Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="border-b border-border px-4 py-3 last:border-b-0">
              <Skeleton className="h-10 w-full" />
            </div>
          ))}

          {requests !== null && requests.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No withdrawal requests at the moment.
            </div>
          )}

          {requests?.map((request) => (
            <div key={request.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {request.userName || request.userId || request.uid || request.id}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatZAR(request.amount || 0)} · {request.status || 'pending'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={String(request.status || 'pending').toLowerCase() === 'completed' ? 'success' : 'warning'} className="capitalize">
                  {request.status || 'pending'}
                </Badge>

                {String(request.status || '').toLowerCase() !== 'completed' && (
                  <Button size="sm" variant="outline" onClick={() => approveRequest(request)}>
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
