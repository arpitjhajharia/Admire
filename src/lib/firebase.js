// src/lib/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, collection, doc } from 'firebase/firestore';

// Firebase config from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 1. Initialize the MAIN App
const app = getApps().some(a => a.name === '[DEFAULT]') ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize the SECONDARY App (Required for User Manager)
// This allows the Admin to create users without getting logged out themselves.
const secondaryApp = getApps().some(a => a.name === 'secondary')
    ? getApp('secondary')
    : initializeApp(firebaseConfig, 'secondary');

// Exports
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

// Fix for Firestore watch stream errors (ve:-1 / ID: ca9 / b815) caused by WebSocket multiplexer issues.
// Force long polling outright: auto-detection re-runs a connection probe on every
// fresh tab and can stall for ~30s+ before falling back on networks like this one.
// (auto-detect defaults to true in newer SDKs and must be explicitly disabled
// when forcing, or Firestore throws "cannot be used together" at startup)
// This must be the first Firestore call for the app: ReportingTracker's
// getStorage / firestore-lite instances hang off the same app.
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
});

// NOTE: IndexedDB persistence (enablePersistence) was tried and reverted — its
// multi-tab coordination added 0.5–1s latency to every user action. Fast first
// paint is handled instead by a one-shot firestore/lite REST fetch in views
// that load large collections (plain HTTPS, bypasses the slow watch channel).

export const firebaseApp = app;
export const appId = 'admire-signage-external'; // Preserved your ID

// Every business collection lives under artifacts/{appId}/public/data.
// dataCol('quotes') and dataDoc('settings', 'global') stand in for the old
// db.collection('artifacts').doc(appId).collection('public').doc('data')... chains.
export const dataCol = (...segments) => collection(db, 'artifacts', appId, 'public', 'data', ...segments);
export const dataDoc = (...segments) => doc(db, 'artifacts', appId, 'public', 'data', ...segments);

export default app;
