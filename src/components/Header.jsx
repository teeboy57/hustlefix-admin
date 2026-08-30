import React from 'react'
import { Menu, LogOut, Bell, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { initials } from '@/lib/utils'
import { useEmergencyCount } from '@/hooks/useEmergencyCount'
import { useEmergencyRequests } from '@/hooks/useEmergencyRequests'

export default function Header({ onMenuClick, title }) {
  const { profile, logout } = useAuth()
  const emergencyCount = useEmergencyCount()
  const emergencyRequests = useEmergencyRequests()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-white/80 px-4 shadow-[0_10px_25px_rgba(15,23,42,0.03)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg border border-border bg-white p-2 text-muted-foreground shadow-sm hover:bg-secondary lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operations</p>
          <h1 className="text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative rounded-xl border border-border bg-white p-2.5 text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground">
            <Bell size={16} />
            {emergencyCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-destructive ring-2 ring-white" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Emergency alerts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {emergencyRequests.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No active emergencies.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-1">
                {emergencyRequests.map((request) => (
                  <div key={request.id} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-2.5 text-sm">
                    <AlertTriangle size={14} className="mt-0.5 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{request.type || 'Emergency'}</p>
                      <p className="truncate text-xs text-muted-foreground">{request.userName || request.phone || 'Unknown reporter'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-white px-1.5 py-1.5 shadow-sm outline-none transition hover:bg-secondary">
            <Avatar className="h-8 w-8 ring-2 ring-primary/10">
              <AvatarImage src={profile?.photoURL} alt={profile?.name} />
              <AvatarFallback>{initials(profile?.name || profile?.email || 'A')}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-medium leading-none text-foreground">
                {profile?.name || 'Admin'}
              </p>
              <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">
                {profile?.email}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2 pb-1.5 text-xs text-muted-foreground truncate">{profile?.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut size={14} /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
