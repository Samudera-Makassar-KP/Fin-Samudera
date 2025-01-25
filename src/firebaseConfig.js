// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';  // Import Firestore
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB5-x2X8IIbKCvn7OAsbUkDvFB52_jyR9A",
    authDomain: "samudera-web-cbf2f.firebaseapp.com",
    projectId: "samudera-web-cbf2f",
    storageBucket: "samudera-web-cbf2f.firebasestorage.app",
    messagingSenderId: "914292170028",
    appId: "1:914292170028:web:c415b02f810d92bfd9e089",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Mendapatkan instance Auth dan Firestore
const auth = getAuth(app);
const db = getFirestore(app);  
const storage = getStorage(app)

// Initialize Firebase Authentication and export it
export default app;

export { auth, db, storage };  
