import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '@/firebase/firebaseConfig'

export function useEmergencyRequests() {
  const [requests, setRequests] = useState([])

  useEffect(() => {
    const emergencyRef = ref(db, 'emergency_requests')
    const unsubscribe = onValue(emergencyRef, (snapshot) => {
      if (!snapshot.exists()) {
        setRequests([])
        return
      }

      const data = snapshot.val() || {}
      const list = Object.entries(data)
        .map(([id, request]) => ({ id, ...request }))
        .filter((request) => request && ['pending', 'responded'].includes(String(request.status || '').toLowerCase()))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

      setRequests(list)
    })

    return () => unsubscribe()
  }, [])

  return requests
}
