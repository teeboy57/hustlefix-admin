import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '@/firebase/firebaseConfig'

/**
 * Subscribes to /emergency_requests and returns the live count of requests
 * whose status is 'pending' or 'responded'. This matches the Android app's
 * emergency workflow and keeps the admin badge aligned with the active queue.
 */
export function useEmergencyCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const emergencyRef = ref(db, 'emergency_requests')
    const unsubscribe = onValue(emergencyRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCount(0)
        return
      }
      const data = snapshot.val()
      const activeCount = Object.values(data).filter(
        (req) => ['pending', 'responded'].includes(String(req.status || '').toLowerCase())
      ).length
      setCount(activeCount)
    })

    return () => unsubscribe()
  }, [])

  return count
}
