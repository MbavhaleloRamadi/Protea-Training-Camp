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
// main.ts
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const firebase_config_1 = require("./firebase-config");
const app = (0, app_1.initializeApp)(firebase_config_1.firebaseConfig);
const db = (0, firestore_1.getFirestore)(app);
// Function to load leaderboard from Firestore
function loadLeaderboard() {
    return __awaiter(this, void 0, void 0, function* () {
        const leaderboardEl = document.getElementById('leaderboard');
        if (!leaderboardEl)
            return;
        const submissionsSnap = yield (0, firestore_1.getDocs)((0, firestore_1.collection)(db, 'submissions'));
        const scoreMap = {};
        submissionsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.name && data.score) {
                scoreMap[data.name] = (scoreMap[data.name] || 0) + data.score;
            }
        });
        const scores = Object.entries(scoreMap).map(([name, score]) => ({ name, score }));
        scores.sort((a, b) => b.score - a.score);
        leaderboardEl.innerHTML = scores.map((u, i) => `<li><strong>${i + 1}. ${u.name}</strong> - ${u.score} pts</li>`).join('');
    });
}
document.addEventListener('DOMContentLoaded', loadLeaderboard);
