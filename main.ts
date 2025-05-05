//main.ts

// main.ts
import { db } from "./firebase-config";
import { collection, getDocs } from "firebase/firestore";

async function displayLeaderboard() {
  const leaderboardDiv = document.getElementById("leaderboard");
  const userScores: any[] = [];

  const snapshot = await getDocs(collection(db, "submissions"));

  snapshot.forEach((doc) => {
    const data = doc.data();
    userScores.push({ name: data.name, score: data.totalScore });
  });

  userScores.sort((a, b) => b.score - a.score);

  leaderboardDiv!.innerHTML = `
    <ol>
      ${userScores.map(user => `<li>${user.name}: ${user.score} pts</li>`).join('')}
    </ol>
  `;
}

displayLeaderboard();
