import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ref, onValue, update } from 'firebase/database'
import { Search, MoreHorizontal, Ban, ShieldCheck, CheckCircle2, ShieldOff, UserCog } from 'lucide-react'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { initials } from '@/lib/utils'
import { logAdminAction } from '@/lib/activity'
import { useAuth } from '@/context/AuthContext'

const roleFilters = ['all', 'client', 'worker', 'admin']

const getJoinedTimestamp = (user) => {
  if (!user) return null

  const timestampValue = user.createdAt ?? user.joinedAt ?? user.created_at ?? user.joined_at ?? user.createdOn ?? user.registrationDate ?? user.registeredAt

  if (timestampValue === null || timestampValue === undefined || timestampValue === '') {
    return null
  }

  if (typeof timestampValue === 'number') {
    return Number.isFinite(timestampValue) ? timestampValue : null
  }

  const asNumber = Number(timestampValue)
  if (Number.isFinite(asNumber)) {
    return asNumber
  }

  const asDate = new Date(timestampValue)
  return Number.isNaN(asDate.getTime()) ? null : asDate.getTime()
}

const formatJoinedDate = (user) => {
  const timestamp = getJoinedTimestamp(user)
  if (!timestamp) return 'No join date recorded'

  return new Date(timestamp).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function UserManagement() {
  const { profile } = useAuth()
  const [users, setUsers] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { type, uid, name }
  const [verificationReview, setVerificationReview] = useState({ rejectionReason: '', adminNotes: '' })
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    const usersRef = ref(db, 'users')
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {}
      const list = Object.entries(data).map(([uid, u]) => ({ uid, ...u }))
      setUsers(list)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!users) return
    setSelectedIds((current) => current.filter((uid) => users.some((u) => u.uid === uid)))
  }, [users])

  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const visibleUserIds = useMemo(() => filtered.map((u) => u.uid), [filtered])
  const allVisibleSelected = visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedIds.includes(id))

  const toggleUserSelection = (uid) => {
    setSelectedIds((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]
    )
  }

  const toggleSelectVisible = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleUserIds.includes(id))
      }
      return Array.from(new Set([...current, ...visibleUserIds]))
    })
  }

  const executeBulkAction = async (type) => {
    if (!selectedIds.length) return

    setActionError(null)

    try {
      const selectedUsers = users.filter((user) => selectedIds.includes(user.uid))
      const updates = []

      for (const user of selectedUsers) {
        const uid = user.uid
        const name = user.name || user.email || uid

        if (type === 'suspend') {
          const suspensionUntil = Date.now() + (7 * 24 * 60 * 60 * 1000)
          updates.push(update(ref(db, `users/${uid}`), { isSuspended: true, suspensionUntil }))
          updates.push(logAdminAction({ type: 'user_suspended', message: `Bulk suspended user ${name}`, entityId: uid }))
        } else if (type === 'unsuspend') {
          updates.push(update(ref(db, `users/${uid}`), { isSuspended: false, suspensionUntil: null }))
          updates.push(logAdminAction({ type: 'user_reinstated', message: `Bulk reinstated user ${name}`, entityId: uid }))
        } else if (type === 'verify') {
          if (user.role === 'worker') {
            updates.push(update(ref(db, `users/${uid}`), {
              verificationStatus: 'verified',
              isVerified: true,
              reviewedByAdminId: profile?.uid || 'admin',
              reviewedByAdminName: profile?.name || profile?.email || 'Admin',
            }))
            updates.push(logAdminAction({ type: 'worker_verified', message: `Bulk verified worker ${name}`, entityId: uid }))
          }
        }
      }

      await Promise.all(updates)
      setSelectedIds([])
    } catch (err) {
      console.error('Failed to bulk update users:', err)
      setActionError('One or more bulk updates failed. Check your connection and try again.')
    }
  }

  const runAction = async () => {
    if (!confirmAction) return
    const { type, uid, name } = confirmAction
    setActionError(null)
    try {
      if (type === 'suspend') {
        const suspensionUntil = Date.now() + (7 * 24 * 60 * 60 * 1000)
        await update(ref(db, `users/${uid}`), { isSuspended: true, suspensionUntil })
        await logAdminAction({ type: 'user_suspended', message: `Suspended user ${name || uid}`, entityId: uid })
      } else if (type === 'unsuspend') {
        await update(ref(db, `users/${uid}`), { isSuspended: false, suspensionUntil: null })
        await logAdminAction({ type: 'user_reinstated', message: `Reinstated user ${name || uid}`, entityId: uid })
      } else if (type === 'verify') {
        await update(ref(db, `users/${uid}`), {
          verificationStatus: 'verified',
          isVerified: true,
          reviewedByAdminId: profile?.uid || 'admin',
          reviewedByAdminName: profile?.name || profile?.email || 'Admin',
        })
        await logAdminAction({ type: 'worker_verified', message: `Verified worker ${name || uid}`, entityId: uid })
      } else if (type === 'reject_verification') {
        const rejectionReason = (verificationReview.rejectionReason || 'Documents did not meet the required verification standard.').trim()
        const adminNotes = (verificationReview.adminNotes || 'Please resubmit the required documents.').trim()
        await update(ref(db, `users/${uid}`), {
          verificationStatus: 'rejected',
          isVerified: false,
          rejectionReason,
          adminNotes,
          reviewedByAdminId: profile?.uid || 'admin',
          reviewedByAdminName: profile?.name || profile?.email || 'Admin',
        })
        await logAdminAction({ type: 'worker_rejected', message: `Rejected verification for ${name || uid}`, entityId: uid })
      } else if (type === 'make_admin') {
        await update(ref(db, `users/${uid}`), { role: 'admin' })
        await logAdminAction({ type: 'role_changed', message: `Promoted ${name || uid} to admin`, entityId: uid })
      }
    } catch (err) {
      console.error('Failed to update user:', err)
      setActionError('The user update failed. Check your connection and try again.')
    } finally {
      setConfirmAction(null)
      setVerificationReview({ rejectionReason: '', adminNotes: '' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">All users</p>
          <p className="text-xs text-muted-foreground">
            {users ? `${filtered.length} of ${users.length}` : '—'} accounts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="w-full min-w-0 sm:w-64 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-lg border border-border bg-white p-0.5">
            {roleFilters.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  roleFilter === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">{selectedIds.length} selected</span>
              <Button variant="outline" size="sm" onClick={() => executeBulkAction('suspend')}>
                Suspend
              </Button>
              <Button variant="outline" size="sm" onClick={() => executeBulkAction('unsuspend')}>
                Reinstate
              </Button>
              <Button variant="outline" size="sm" onClick={() => executeBulkAction('verify')}>
                Verify workers
              </Button>
            </div>
          )}
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
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectVisible}
                    aria-label="Select visible users"
                    className="h-4 w-4 rounded border-border"
                  />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users === null &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {users !== null && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No users match your search.
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((u, idx) => (
                <motion.tr
                  key={u.uid}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                  className="border-b border-border transition-colors hover:bg-muted/50"
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(u.uid)}
                      onChange={() => toggleUserSelection(u.uid)}
                      aria-label={`Select ${u.name || u.email}`}
                      className="h-4 w-4 rounded border-border"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.photoURL} alt={u.name} />
                        <AvatarFallback>{initials(u.name || u.email || '?')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'worker' ? 'default' : u.role === 'admin' ? 'warning' : 'secondary'} className="capitalize">
                      {u.role || 'client'}
                    </Badge>
                    {u.role === 'worker' && u.isVerified && (
                      <Badge variant="success" className="ml-1.5">
                        <CheckCircle2 size={11} className="mr-1" /> Verified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.isSuspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatJoinedDate(u)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedUser(u)}>
                          View details
                        </DropdownMenuItem>
                        {u.role === 'worker' && !u.isVerified && (
                          <>
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ type: 'verify', uid: u.uid, name: u.name })}
                            >
                              <ShieldCheck size={14} /> Verify worker
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({
                                type: 'reject_verification',
                                uid: u.uid,
                                name: u.name,
                                rejectionReason: 'Documents did not meet verification requirements.',
                                adminNotes: 'Please resubmit the required documents and try again.',
                              })}
                            >
                              <ShieldOff size={14} /> Reject verification
                            </DropdownMenuItem>
                          </>
                        )}
                        {u.role !== 'admin' && (
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({ type: 'make_admin', uid: u.uid, name: u.name })}
                          >
                            <UserCog size={14} /> Make admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {u.isSuspended ? (
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({ type: 'unsuspend', uid: u.uid, name: u.name })}
                          >
                            <ShieldOff size={14} /> Reinstate user
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setConfirmAction({ type: 'suspend', uid: u.uid, name: u.name })}
                          >
                            <Ban size={14} /> Suspend user
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedUser?.name || selectedUser?.email || 'User details'}</DialogTitle>
            <DialogDescription>Account overview and safety status.</DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedUser.photoURL} alt={selectedUser.name} />
                  <AvatarFallback>{initials(selectedUser.name || selectedUser.email || '?')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-foreground">{selectedUser.name || 'Unnamed user'}</p>
                    <Badge variant={selectedUser.role === 'worker' ? 'default' : selectedUser.role === 'admin' ? 'warning' : 'secondary'} className="capitalize">
                      {selectedUser.role || 'client'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedUser.email || 'No email on file'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 font-medium text-foreground">{selectedUser.isSuspended ? 'Suspended' : 'Active'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Verification</p>
                  <p className="mt-1 font-medium text-foreground">{selectedUser.role === 'worker' ? (selectedUser.isVerified ? 'Verified' : 'Pending') : 'Not applicable'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="mt-1 font-medium text-foreground">{formatJoinedDate(selectedUser)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">UID</p>
                  <p className="mt-1 truncate font-mono text-xs text-foreground">{selectedUser.uid}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedUser.role === 'worker' && !selectedUser.isVerified && (
                  <>
                    <Button size="sm" onClick={() => {
                      setSelectedUser(null)
                      setConfirmAction({ type: 'verify', uid: selectedUser.uid, name: selectedUser.name })
                    }}>Verify worker</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelectedUser(null)
                      setConfirmAction({
                        type: 'reject_verification',
                        uid: selectedUser.uid,
                        name: selectedUser.name,
                        rejectionReason: 'Documents did not meet verification requirements.',
                        adminNotes: 'Please resubmit the required documents and try again.',
                      })
                    }}>Reject verification</Button>
                  </>
                )}
                {selectedUser.role !== 'admin' && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedUser(null)
                    setConfirmAction({ type: 'make_admin', uid: selectedUser.uid, name: selectedUser.name })
                  }}>Make admin</Button>
                )}
                {selectedUser.isSuspended ? (
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedUser(null)
                    setConfirmAction({ type: 'unsuspend', uid: selectedUser.uid, name: selectedUser.name })
                  }}>Reinstate</Button>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => {
                    setSelectedUser(null)
                    setConfirmAction({ type: 'suspend', uid: selectedUser.uid, name: selectedUser.name })
                  }}>Suspend</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => {
        if (!open) {
          setConfirmAction(null)
          setVerificationReview({ rejectionReason: '', adminNotes: '' })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'suspend' && 'Suspend this user?'}
              {confirmAction?.type === 'unsuspend' && 'Reinstate this user?'}
              {confirmAction?.type === 'verify' && 'Verify this worker?'}
              {confirmAction?.type === 'reject_verification' && 'Reject verification?'}
              {confirmAction?.type === 'make_admin' && 'Promote to admin?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === 'suspend' &&
                `${confirmAction?.name || 'This user'} will immediately lose access to the app and won't be able to book or accept jobs.`}
              {confirmAction?.type === 'unsuspend' &&
                `${confirmAction?.name || 'This user'} will regain full access to the app.`}
              {confirmAction?.type === 'verify' &&
                `${confirmAction?.name || 'This worker'} will be marked as ID-verified and can be shown a verified badge to clients.`}
              {confirmAction?.type === 'reject_verification' &&
                `${confirmAction?.name || 'This worker'} will be marked as rejected and the user will need to resubmit documents.`}
              {confirmAction?.type === 'make_admin' &&
                `${confirmAction?.name || 'This user'} will be granted admin access to the dashboard and all protected routes.`}
            </DialogDescription>
          </DialogHeader>

          {confirmAction?.type === 'reject_verification' && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Rejection reason</label>
                <Input
                  value={verificationReview.rejectionReason}
                  onChange={(e) => setVerificationReview((current) => ({ ...current, rejectionReason: e.target.value }))}
                  placeholder="Documents did not meet verification requirements."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Admin notes</label>
                <textarea
                  value={verificationReview.adminNotes}
                  onChange={(e) => setVerificationReview((current) => ({ ...current, adminNotes: e.target.value }))}
                  className="min-h-[88px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Please resubmit the required documents and try again."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmAction(null)
              setVerificationReview({ rejectionReason: '', adminNotes: '' })
            }}>Cancel</Button>
            <Button
              variant={confirmAction?.type === 'suspend' ? 'destructive' : 'default'}
              onClick={runAction}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
