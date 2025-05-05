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
const firebase_config_1 = require("./firebase-config");
const firestore_1 = require("firebase/firestore");
function displayLeaderboard() {
    return __awaiter(this, void 0, void 0, function* () {
        const leaderboardDiv = document.getElementById("leaderboard");
        const userScores = [];
        const snapshot = yield (0, firestore_1.getDocs)((0, firestore_1.collection)(firebase_config_1.db, "submissions"));
        snapshot.forEach((doc) => {
            const data = doc.data();
            userScores.push({ name: data.name, score: data.totalScore });
        });
        userScores.sort((a, b) => b.score - a.score);
        leaderboardDiv.innerHTML = `
    <ol>
      ${userScores.map(user => `<li>${user.name}: ${user.score} pts</li>`).join('')}
    </ol>
  `;
    });
}
displayLeaderboard();
