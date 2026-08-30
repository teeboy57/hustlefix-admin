# HustleFix Admin

## Live Demo

Visit the admin dashboard here:

https://hustlefix-admin.netlify.app/


HustleFix Admin is a React + Vite dashboard for managing users, jobs, transactions, emergency alerts, and moderation workflows for the HustleFix platform.

## Features
- Admin login and role protection
- User management and moderation actions
- Job oversight
- Emergency alert monitoring
- Transaction log and payouts
- Activity tracking
- Reports and reported-user queue

## Tech stack
- React
- Vite
- Tailwind CSS
- Firebase Authentication
- Firebase Realtime Database
- Firebase Functions (optional for push notifications)

## Local setup
```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Production build
```bash
npm run build
```

## Firebase notes
This project expects Firebase web config values in a local `.env` file using the Vite-prefixed keys:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Notes
The dashboard is designed to run locally and can be extended for live Firebase deployment when billing is enabled for the project.
