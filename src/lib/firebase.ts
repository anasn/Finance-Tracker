import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// FIX: Use initializeFirestore instead of getFirestore + enableIndexedDbPersistence
// enableIndexedDbPersistence was deprecated and caused 15-20 second delays
// because it tried to acquire an exclusive lock on IndexedDB which is slow in
// multi-tab scenarios and on some browsers. Instead we use persistentLocalCache
// via the new API which is non-blocking.
export const db = initializeFirestore(app, {
  // Use memory cache only - no IndexedDB lock contention
  // This eliminates the 15-20 second delay on writes
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
