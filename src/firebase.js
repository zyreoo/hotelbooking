
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDef9tV1YwMgc4ZrBCZ_NkuBy6g10C0-Co",
  authDomain: "hotelbooking-304d9.firebaseapp.com",
  projectId: "hotelbooking-304d9",
  storageBucket: "hotelbooking-304d9.firebasestorage.app",
  messagingSenderId: "370703822798",
  appId: "1:370703822798:web:657118ab0b9a78662f859f",
  measurementId: "G-6KSE1WV6GV"
};

const app = initializeApp(firebaseConfig);
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

const db = getFirestore(app);

export { app, analytics, db };