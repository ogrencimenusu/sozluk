import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Cloud Firestore with long-polling auto-detection to prevent hanging on mobile networks / iOS Safari
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

// NOTE: Firestore IndexedDB persistence is disabled because this app already has a custom, robust
// offline synchronization layer using localStorage (local_words, local_custom_lists, etc.).
// Leaving Firestore IndexedDB persistence enabled causes WebKit / iOS Safari to deadlock/hang
// indefinitely on batch.commit() and getDocs() when tabs are suspended, private mode is active,
// or IndexedDB locks are orphaned in background tabs.
/*
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported by browser');
    }
});
*/

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();