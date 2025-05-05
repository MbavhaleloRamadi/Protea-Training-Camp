// main.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface UserScore {
  name: string;
  score: number;
}

// Function to load leaderboard from Firestore
async function loadLeaderboard() {
  const leaderboardEl = document.getElementById('leaderboard');
  if (!leaderboardEl) return;

  const submissionsSnap = await getDocs(collection(db, 'submissions'));
  const scoreMap: Record<string, number> = {};

  submissionsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.name && data.score) {
      scoreMap[data.name] = (scoreMap[data.name] || 0) + data.score;
    }
  });

  const scores: UserScore[] = Object.entries(scoreMap).map(([name, score]) => ({ name, score }));
  scores.sort((a, b) => b.score - a.score);

  leaderboardEl.innerHTML = scores.map((u, i) =>
    `<li><strong>${i + 1}. ${u.name}</strong> - ${u.score} pts</li>`).join('');
}

document.addEventListener('DOMContentLoaded', loadLeaderboard);
