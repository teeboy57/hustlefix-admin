// src/firebase/firebaseConfig.js
//
// Firebase setup for HustleFix Admin.
// Fill in your project's credentials below, or (recommended) provide them
// via a .env file at the project root using the VITE_ prefixed keys —
// Vite exposes these automatically through import.meta.env.
//
// .env example:
//   VITE_FIREBASE_API_KEY=xxxx
//   VITE_FIREBASE_AUTH_DOMAIN=hustlefix.firebaseapp.com
//   VITE_FIREBASE_DATABASE_URL=https://hustlefix-default-rtdb.firebaseio.com
//   VITE_FIREBASE_PROJECT_ID=hustlefix
//   VITE_FIREBASE_STORAGE_BUCKET=hustlefix.appspot.com
//   VITE_FIREBASE_MESSAGING_SENDER_ID=xxxx
//   VITE_FIREBASE_APP_ID=xxxx

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

export const isFirebaseConfigured = requiredEnvKeys.every((key) => Boolean(import.meta.env[key]))

export const firebaseConfigError = isFirebaseConfigured
  ? null
  : 'Firebase is not configured yet. Copy .env.example to .env and add your Firebase web config values, then restart the app.'

let app = null
let auth = null
let db = null
let storage = null
let functions = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getDatabase(app)
  storage = getStorage(app)
  functions = getFunctions(app)
}

export { app, auth, db, storage, functions }
export default app
