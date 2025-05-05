// auth.ts
import { auth, db } from "../firebase-config";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Register Handler
const regForm = document.getElementById("registerForm") as HTMLFormElement | null;
if (regForm) {
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (document.getElementById("name") as HTMLInputElement).value;
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save name to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
      });

      alert("Registered successfully!");
      window.location.href = "../index.html";
    } catch (error) {
      alert("Error: " + (error as Error).message);
    }
  });
}

// Login Handler
const logForm = document.getElementById("loginForm") as HTMLFormElement | null;
if (logForm) {
  logForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Logged in successfully!");
      window.location.href = "../index.html";
    } catch (error) {
      alert("Login error: " + (error as Error).message);
    }
  });
}
