import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/firebaseConfig'

export async function sendUserNotification({ userId, title, body, screen }) {
  if (!userId || !screen || !functions) return { success: false, reason: 'not-configured' }

  try {
    const sendNotification = httpsCallable(functions, 'sendFcmNotification')
    const result = await sendNotification({
      userId,
      title: title || 'HustleFix',
      body: body || '',
      screen,
    })

    return result?.data || { success: true }
  } catch (error) {
    console.error('Failed to send FCM notification:', error)
    return { success: false, reason: error?.message || 'unknown-error' }
  }
}
