import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

const titles = {
  '/': 'Overview',
  '/users': 'User Management',
  '/jobs': 'Job Oversight',
  '/emergency': 'Emergency Hub',
  '/transactions': 'Transaction Log',
  '/activity': 'Activity Log',
  '/reports': 'Reports',
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] || 'HustleFix Admin'

  return (
    <div className="flex h-screen overflow-hidden bg-secondary/40">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />

        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
