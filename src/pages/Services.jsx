import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { Search, Wrench } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatZAR } from '@/lib/utils'

const displayRateType = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not set'
}

const servicePrice = (service) => Number(
  service.bookingFee ?? service.price ?? service.amount ?? service.rate ?? 0,
) || 0

const normalizeServices = (data) => Object.entries(data).flatMap(([id, value]) => {
  if (!value || typeof value !== 'object') return []
  const serviceFields = ['name', 'title', 'category', 'rateType', 'bookingFee', 'price', 'amount', 'rate']
  if (serviceFields.some((field) => value[field] !== undefined)) return [{ id, ...value }]

  return Object.entries(value).flatMap(([serviceId, service]) => (
    service && typeof service === 'object'
      ? [{ id: serviceId, providerId: id, ...service }]
      : []
  ))
})

export default function Services() {
  const [services, setServices] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [rateTypeFilter, setRateTypeFilter] = useState('all')

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'services'), (snapshot) => {
      const data = snapshot.val() || {}
      setServices(normalizeServices(data))
    })
    return () => unsubscribe()
  }, [])

  const categories = useMemo(() => (
    [...new Set((services || []).map((service) => service.category).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)))
  ), [services])

  const rateTypes = useMemo(() => (
    [...new Set((services || []).map((service) => String(service.rateType || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  ), [services])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (services || []).filter((service) => {
      const matchesSearch = !query || [
        service.name,
        service.title,
        service.description,
        service.category,
        service.rateType,
        service.id,
      ].some((value) => String(value || '').toLowerCase().includes(query))
      const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter
      const matchesRate = rateTypeFilter === 'all' || service.rateType === rateTypeFilter
      return matchesSearch && matchesCategory && matchesRate
    })
  }, [services, search, categoryFilter, rateTypeFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wrench size={15} className="text-primary" /> Services
          </p>
          <p className="text-xs text-muted-foreground">
            {services ? `${filtered.length} of ${services.length} services` : 'Loading services'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search services"
              placeholder="Search services…"
              className="w-full min-w-0 pl-8 sm:w-56"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label="Filter services by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select
            aria-label="Filter services by rate type"
            value={rateTypeFilter}
            onChange={(event) => setRateTypeFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          >
            <option value="all">All rate types</option>
            {rateTypes.map((rateType) => <option key={rateType} value={rateType}>{displayRateType(rateType)}</option>)}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Service ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services === null && Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ))}
              {services !== null && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    {services.length ? 'No services match your filters.' : 'No services are available at /services.'}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{service.name || service.title || 'Unnamed service'}</p>
                    {service.description && <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{service.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{service.category || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{displayRateType(service.rateType)}</Badge>
                      <span className="text-sm font-semibold text-foreground">{formatZAR(servicePrice(service))}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{service.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
