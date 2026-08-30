import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Wrench, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const { login, isAdmin, loading: authLoading, authError, isFirebaseConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(authError)

  if (!authLoading && isAdmin) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  const displayError = error || authError

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await login(email.trim(), password)
    setSubmitting(false)
    if (!result.success) {
      setError(result.error)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Wrench className="h-4.5 w-4.5" size={18} />
          </div>
          <span className="text-lg font-semibold tracking-tight">HustleFix</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-md"
        >
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Every job, worker, and rand — in one control room.
          </p>
          <p className="mt-4 text-sm text-primary-foreground/70">
            Sign in with your HustleFix admin account to manage clients, verify
            workers, and keep an eye on the platform in real time.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative text-xs text-primary-foreground/50"
        >
          HustleFix Admin · Internal use only
        </motion.p>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center bg-background p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wrench size={18} />
            </div>
            <span className="text-lg font-semibold tracking-tight">HustleFix</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your credentials to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@hustlefix.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {displayError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{displayError}</span>
              </motion.div>
            )}

            {!isFirebaseConfigured && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                Add your Firebase values to the project .env file and restart the dev server.
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !isFirebaseConfigured}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Only accounts with <code className="rounded bg-muted px-1 py-0.5">role: admin</code> can access this dashboard.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
