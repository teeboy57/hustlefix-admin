import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * ProtectedRoute
 *
 * Wrap any route that should only be reachable by a signed-in Firebase user
 * whose Realtime Database profile at /users/{uid} has role: 'admin'.
 * AuthContext already rejects (signs out) any non-admin session, so by the
 * time loading is false, `isAdmin` reliably reflects an authorized admin.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/" element={<DashboardLayout />}>
 *       <Route index element={<Overview />} />
 *     </Route>
 *   </Route>
 */
export default function ProtectedRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children ? children : <Outlet />
}
