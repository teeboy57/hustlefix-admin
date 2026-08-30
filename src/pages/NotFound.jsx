import React from 'react'
import { Link } from 'react-router-dom'
import { Home, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <SearchX size={24} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you requested does not exist or has moved.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button>
            <Home size={14} /> Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
