// firebase-config.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLFOHGb5xaMSUtE_vgVO0aaY6MfLySeTs",
  authDomain: "protea-training-camp.firebaseapp.com",
  projectId: "protea-training-camp",
  storageBucket: "protea-training-camp.firebasestorage.app",
  messagingSenderId: "649833361697",
  appId: "1:649833361697:web:5c402a67872ca10fe30e60",
  measurementId: "G-K1HKHPG6HG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
