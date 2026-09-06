import React, { useEffect, useMemo, useState } from 'react'
import { onValue, ref, update } from 'firebase/database'
import { Check, ExternalLink, FileText, Search, ShieldCheck, X } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getVerificationDocuments, isPendingVerification } from '@/lib/verification'

const isImageDocument = (url) => {
  const normalizedUrl = String(url).toLowerCase()
  return /\.(avif|gif|jpe?g|png|webp)(\?|$)/.test(normalizedUrl) || normalizedUrl.includes('/image/upload/')
}

export default function VerificationManagement() {
  const [users, setUsers] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [rejectingUid, setRejectingUid] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [savingUid, setSavingUid] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'users'), (snapshot) => {
      const data = snapshot.val() || {}
      setUsers(Object.entries(data).map(([uid, user]) => ({ uid, ...user })))
    }, () => setError('Could not load verification requests.'))

    return () => unsubscribe()
  }, [])

  const pendingUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (users || []).filter((user) => {
      const matchesSearch = !query || `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(query)
      return isPendingVerification(user) && matchesSearch
    })
  }, [users, search])

  const updateVerification = async (user, status, reason = '') => {
    setSavingUid(user.uid)
    setError('')
    try {
      const changes = {
        verificationStatus: status,
        isVerified: status === 'verified',
      }
      if (status === 'rejected') changes.rejectionReason = reason.trim()
      await update(ref(db, `users/${user.uid}`), changes)
      setRejectingUid(null)
      setRejectionReason('')
      if (selectedUser?.uid === user.uid) setSelectedUser(null)
    } catch (err) {
      console.error('Failed to update verification status:', err)
      setError('The verification update failed. Check your connection and try again.')
    } finally {
      setSavingUid(null)
    }
  }

  const submitRejection = (user) => {
    const reason = rejectionReason.trim()
    if (!reason) {
      setError('Add a rejection reason before rejecting this verification.')
      return
    }
    updateVerification(user, 'rejected', reason)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Pending verifications</p>
          <p className="text-xs text-muted-foreground">Review worker documents before granting a verified badge.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="pl-8" />
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users === null && Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)}
              {users !== null && pendingUsers.length === 0 && <TableRow><TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">No pending verification requests.</TableCell></TableRow>}
              {pendingUsers.map((user) => {
                const documents = getVerificationDocuments(user)
                const isRejecting = rejectingUid === user.uid
                const isSaving = savingUid === user.uid
                return (
                  <React.Fragment key={user.uid}>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedUser(user)}>
                      <TableCell>
                        <button className="text-left" onClick={() => setSelectedUser(user)}>
                          <p className="text-sm font-medium text-foreground">{user.name || 'Unnamed worker'}</p>
                          <p className="text-xs text-muted-foreground">{user.email || user.uid}</p>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><FileText size={14} /> {documents.length} submitted</span>
                          {documents.length > 0 ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedUser(user)
                              }}
                            >
                              View documents
                            </button>
                          ) : (
                            <span className="text-xs text-amber-600">No links uploaded</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="warning">Pending</Badge></TableCell>
                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        {!isRejecting ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => updateVerification(user, 'verified')} disabled={isSaving}><Check size={14} /> Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectingUid(user.uid)} disabled={isSaving}><X size={14} /> Reject</Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <Input autoFocus value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Reason, e.g. ID is blurry" className="h-8 w-52" />
                            <Button size="sm" variant="destructive" onClick={() => submitRejection(user)} disabled={isSaving}>Confirm reject</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRejectingUid(null); setRejectionReason('') }} disabled={isSaving}>Cancel</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedUser?.name || 'Worker verification'}</DialogTitle>
            <DialogDescription>{selectedUser?.email || 'Review submitted verification documents.'}</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {getVerificationDocuments(selectedUser).map((document) => (
                  <div key={document.label} className="overflow-hidden rounded-lg border border-border bg-secondary/30">
                    <div className="flex items-center justify-between px-3 py-2"><span className="text-sm font-medium">{document.label}</span><a href={document.url} target="_blank" rel="noreferrer" aria-label={`Open ${document.label}`} className="text-primary"><ExternalLink size={15} /></a></div>
                    {isImageDocument(document.url) ? (
                      <a href={document.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-white"><img src={document.url} alt={document.label} className="h-full w-full object-contain" /></a>
                    ) : (
                      <a href={document.url} target="_blank" rel="noreferrer" className="flex aspect-[4/3] items-center justify-center gap-2 bg-secondary/40 text-sm font-medium text-primary hover:underline"><FileText size={18} /> Open document</a>
                    )}
                  </div>
                ))}
              </div>
              {getVerificationDocuments(selectedUser).length === 0 && <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">No idDocumentUrl or certificateUrl was found on this user record.</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>Close</Button>
                <Button onClick={() => updateVerification(selectedUser, 'verified')} disabled={savingUid === selectedUser.uid}><ShieldCheck size={14} /> Approve worker</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
