import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ref, onValue } from 'firebase/database'
import {
  LayoutDashboard, Users, Briefcase, Siren, Receipt, Activity, BarChart3, Wrench, X, MessageSquareText, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEmergencyCount } from '@/hooks/useEmergencyCount'
import { db } from '@/firebase/firebaseConfig'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'User Management', icon: Users },
  { to: '/jobs', label: 'Job Oversight', icon: Briefcase },
  { to: '/emergency', label: 'Emergency Hub', icon: Siren, emergency: true },
  { to: '/transactions', label: 'Transaction Log', icon: Receipt },
  { to: '/activity', label: 'Activity Log', icon: Activity },
  { to: '/revenue', label: 'Revenue History', icon: BarChart3 },
  { to: '/payouts', label: 'Payout Requests', icon: Receipt },
  { to: '/command-control', label: 'Command & Control', icon: Wrench },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/support-chat', label: 'Support Chat', icon: MessageSquareText },
  { to: '/verification', label: 'Verification Management', icon: ShieldCheck },
]

export default function Sidebar({ open, onClose }) {
  const emergencyCount = useEmergencyCount()
  const [disputeCount, setDisputeCount] = useState(0)

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'disputes'), (snapshot) => {
      const data = snapshot.val() || {}
      const unresolved = Object.values(data).filter(
        (item) => String(item?.status || '').toLowerCase() !== 'resolved'
      ).length
      setDisputeCount(unresolved)
    })

    return () => unsubscribe()
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-xs flex-col border-r border-border bg-white/90 shadow-[8px_0_30px_rgba(15,23,42,0.06)] backdrop-blur-md transition-transform duration-200 sm:w-64 lg:static lg:w-64 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/80 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 p-1 shadow-lg shadow-indigo-500/20">
              <img src="/hustlefix-icon.svg" alt="HustleFix logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-sm font-semibold tracking-tight text-foreground">HustleFix</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Admin</span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200 sm:px-3',
                  isActive
                    ? 'bg-primary/8 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/8 to-indigo-500/5"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <item.icon size={16} className="relative shrink-0" />
                  <span className="relative truncate text-left">{item.label}</span>
                  {item.to === '/emergency' && emergencyCount > 0 && (
                    <span className="relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground shadow-sm">
                      {emergencyCount}
                    </span>
                  )}
                  {item.to === '/command-control' && disputeCount > 0 && (
                    <span className="relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                      {disputeCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border/80 p-4">
          <div className="rounded-xl bg-gradient-to-r from-slate-900 to-indigo-900 px-3 py-2.5 text-white shadow-lg shadow-indigo-900/15">
            <p className="text-xs font-medium">HustleFix Admin</p>
            <p className="mt-0.5 text-[11px] text-slate-200">v1.0.0 · ZA region</p>
          </div>
        </div>
      </aside>
    </>
  )
}
