import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ref, get } from 'firebase/database'
import { auth, db, isFirebaseConfigured, firebaseConfigError } from '@/firebase/firebaseConfig'

const AuthContext = createContext(null)

const isSuspensionActive = (userProfile) => {
  if (!userProfile) return false

  const isSuspended = userProfile.isSuspended === true || userProfile.suspended === true || userProfile.status === 'suspended'
  if (!isSuspended) return false

  const expirationMs = Number(userProfile.suspensionUntil)
  if (!Number.isFinite(expirationMs) || expirationMs <= 0) return true

  return Date.now() < expirationMs
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(firebaseConfigError)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setFirebaseUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    let isMounted = true
    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setFirebaseUser(null)
        setProfile(null)
        setAuthError('Firebase auth did not respond in time. Please refresh or check your connection.')
        setLoading(false)
      }
    }, 2500)

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return
      clearTimeout(fallbackTimer)
      setAuthError(null)
      if (!user) {
        setFirebaseUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        // Android app stores profiles under /users/{uid} in Realtime Database.
        const snapshot = await get(ref(db, `users/${user.uid}`))
        const userProfile = snapshot.exists() ? snapshot.val() : null
        const isSuspendedAccount = isSuspensionActive(userProfile)

        if (!userProfile || userProfile.role !== 'admin') {
          // Not an admin — reject the session immediately.
          await signOut(auth)
          setFirebaseUser(null)
          setProfile(null)
          setAuthError('This account does not have admin access.')
          setLoading(false)
          return
        }

        if (isSuspendedAccount) {
          await signOut(auth)
          setFirebaseUser(null)
          setProfile(null)
          setAuthError('This account has been suspended. Contact support.')
          setLoading(false)
          return
        }

        setFirebaseUser(user)
        setProfile({ uid: user.uid, ...userProfile })
      } catch (err) {
        console.error('Failed to load admin profile:', err)
        setAuthError('Could not verify admin access. Please try again.')
        await signOut(auth)
      } finally {
        if (isMounted) setLoading(false)
      }
    })

    return () => {
      isMounted = false
      clearTimeout(fallbackTimer)
      unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    setAuthError(null)

    if (!isFirebaseConfigured) {
      const message = firebaseConfigError
      setAuthError(message)
      return { success: false, error: message }
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const snapshot = await get(ref(db, `users/${result.user.uid}`))
      const userProfile = snapshot.exists() ? snapshot.val() : null
      const isSuspendedAccount = isSuspensionActive(userProfile)

      if (!userProfile || userProfile.role !== 'admin') {
        await signOut(auth)
        const message = 'This account does not have admin access.'
        setAuthError(message)
        return { success: false, error: message }
      }

      if (isSuspendedAccount) {
        await signOut(auth)
        const message = 'This account has been suspended. Contact support.'
        setAuthError(message)
        return {
          success: false,
          error: message,
          isSuspended: true,
          user: {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
          },
        }
      }

      return { success: true }
    } catch (err) {
      const message = mapAuthError(err.code)
      setAuthError(message)
      return { success: false, error: message }
    }
  }

  const logout = () => {
    if (!auth) return Promise.resolve()
    return signOut(auth)
  }

  const value = {
    user: firebaseUser,
    profile,
    isAdmin: !!profile && profile.role === 'admin',
    loading,
    authError,
    login,
    logout,
    isFirebaseConfigured,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again shortly.'
    default:
      return 'Sign in failed. Please try again.'
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
