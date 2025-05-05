"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// auth.ts
const firebase_config_1 = require("../firebase-config");
const auth_1 = require("firebase/auth");
const firestore_1 = require("firebase/firestore");
// Register Handler
const regForm = document.getElementById("registerForm");
if (regForm) {
    regForm.addEventListener("submit", (e) => __awaiter(void 0, void 0, void 0, function* () {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        try {
            const userCredential = yield (0, auth_1.createUserWithEmailAndPassword)(firebase_config_1.auth, email, password);
            const user = userCredential.user;
            // Save name to Firestore
            yield (0, firestore_1.setDoc)((0, firestore_1.doc)(firebase_config_1.db, "users", user.uid), {
                name,
                email,
            });
            alert("Registered successfully!");
            window.location.href = "../index.html";
        }
        catch (error) {
            alert("Error: " + error.message);
        }
    }));
}
// Login Handler
const logForm = document.getElementById("loginForm");
if (logForm) {
    logForm.addEventListener("submit", (e) => __awaiter(void 0, void 0, void 0, function* () {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        try {
            yield (0, auth_1.signInWithEmailAndPassword)(firebase_config_1.auth, email, password);
            alert("Logged in successfully!");
            window.location.href = "../index.html";
        }
        catch (error) {
            alert("Login error: " + error.message);
        }
    }));
}
