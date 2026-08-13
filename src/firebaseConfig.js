import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const functionsRegion = process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || 'asia-southeast2';

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, functionsRegion);
const storage = getStorage(app)

// Matikan log internal SDK Firestore (termasuk warning kosmetik seperti
// "BloomFilterError") -- tetap tampilkan error fatal saat development,
// senyap total saat production.
setLogLevel(process.env.NODE_ENV === 'production' ? 'silent' : 'error');

export default app;

export { auth, db, functions, storage };