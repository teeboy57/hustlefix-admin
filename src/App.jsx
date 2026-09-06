import React from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/layouts/DashboardLayout'
import Login from '@/pages/Login'
import Overview from '@/pages/Overview'
import UserManagement from '@/pages/UserManagement'
import JobOversight from '@/pages/JobOversight'
import EmergencyHub from '@/pages/EmergencyHub'
import TransactionLog from '@/pages/TransactionLog'
import ActivityLog from '@/pages/ActivityLog'
import RevenueHistory from '@/pages/RevenueHistory'
import PayoutRequests from '@/pages/PayoutRequests'
import CommandControl from '@/pages/CommandControl'
import Reports from '@/pages/Reports'
import SupportChat from '@/pages/SupportChat'
import VerificationManagement from '@/pages/VerificationManagement'
import PitchDeck from '@/pages/PitchDeck'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pitch" element={<PitchDeck />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="jobs" element={<JobOversight />} />
          <Route path="emergency" element={<EmergencyHub />} />
          <Route path="transactions" element={<TransactionLog />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="revenue" element={<RevenueHistory />} />
          <Route path="payouts" element={<PayoutRequests />} />
          <Route path="command-control" element={<CommandControl />} />
          <Route path="reports" element={<Reports />} />
          <Route path="support-chat" element={<SupportChat />} />
          <Route path="verification" element={<VerificationManagement />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}
