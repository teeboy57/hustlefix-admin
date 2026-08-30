import { ref, push } from 'firebase/database'
import { db } from '@/firebase/firebaseConfig'

export async function logAdminAction({ type, message, entityId, adminName = 'Admin', adminId = 'system' }) {
  try {
    const activityRef = ref(db, 'activity_log')
    await push(activityRef, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      entityId: entityId || null,
      adminName,
      adminId,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Failed to log admin action:', error)
  }
}
