// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBllBBx2H79e0cRtTzUq1bAxZ6psACr1Qc",
  authDomain: "sozluk-e4ae9.firebaseapp.com",
  projectId: "sozluk-e4ae9",
  storageBucket: "sozluk-e4ae9.firebasestorage.app",
  messagingSenderId: "1064112899822",
  appId: "1:1064112899822:web:0581d4248f387bc15e15ff",
  measurementId: "G-WBD55W7LK5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Cloud Firestore and get a reference to the service
import { getFirestore } from "firebase/firestore";
export const db = getFirestore(app);