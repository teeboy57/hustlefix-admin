import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { Activity, Search, ShieldCheck } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'

export default function ActivityLog() {
  const [items, setItems] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const activityRef = ref(db, 'activity_log')
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data)
        .map(([id, item]) => ({ id, ...item }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      setItems(list)
    })
    return () => unsubscribe()
  }, [])

  const filtered = useMemo(() => {
    if (!items) return []
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) =>
      `${item.message || ''} ${item.adminName || ''} ${item.type || ''}`
        .toLowerCase()
        .includes(query)
    )
  }, [items, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Activity size={15} className="text-primary" /> Activity Log
          </p>
          <p className="text-xs text-muted-foreground">Audit trail for admin actions</p>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activity…"
            className="w-full min-w-0 sm:w-64 pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {items === null && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border-b border-border px-4 py-3">
                <Skeleton className="h-8 w-full" />
              </div>
            ))}

            {items !== null && filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No matching activity found.
              </div>
            )}

            {filtered.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ShieldCheck size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.message || 'Admin activity'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{item.adminName || 'System admin'}</span>
                      <span>•</span>
                      <span className="capitalize">{item.type || 'activity'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant="secondary" className="capitalize">{item.type || 'activity'}</Badge>
                  <span className="text-[11px] text-muted-foreground">{formatDate(item.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
