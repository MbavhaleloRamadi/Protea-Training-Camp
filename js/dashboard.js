document.addEventListener("DOMContentLoaded", () => {
  // ───────────────────────────────────────────────────────────
  // DOM Elements - Define all DOM elements at the start
  // ───────────────────────────────────────────────────────────
  const elements = {
    // Loader element
    loader: document.querySelector(".loader-overlay"),
    
    // User info elements
    userName: document.getElementById("user-name"),
    
    // Score display elements
    leaderboardPositionValue: document.getElementById("leaderboard-position-value"),
    weeklyScoreValue: document.getElementById("weekly-score-value"),
    allTimeScoreValue: document.getElementById("all-time-score-value"),
    
    // Score text elements (for new structure)
    leaderboardPositionText: document.querySelector("#leaderboard-position-value .score-text"),
    weeklyScoreText: document.querySelector("#weekly-score-value .score-text"),
    allTimeScoreText: document.querySelector("#all-time-score-value .score-text"),
    
    // Loading icons
    leaderboardLoading: document.querySelector("#leaderboard-position-value .loading-icon"),
    weeklyLoading: document.querySelector("#weekly-score-value .loading-icon"),
    allTimeLoading: document.querySelector("#all-time-score-value .loading-icon"),
    
    // Admin button
    adminButton: document.getElementById("admin-button"),
    
    // Confirmation message
    confirmEl: document.getElementById("confirmationMessage"),

    // Navigation toggle
    navToggle: document.getElementById("nav-toggle")
  };

  // ───────────────────────────────────────────────────────────
  // 1) PAGE LOADER
  // ───────────────────────────────────────────────────────────
  if (elements.loader) {
    window.addEventListener("load", () => {
      // fade out
      elements.loader.style.transition = "opacity 0.6s ease";
      elements.loader.style.opacity = "0";

      // then completely hide
      setTimeout(() => {
        elements.loader.style.display = "none";
        document.body.style.visibility = "visible";
      }, 600);
    });
  }

  // ───────────────────────────────────────────────────────────
  // 2) FIREBASE INITIALIZATION
  // ───────────────────────────────────────────────────────────
  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCLFOHGb5xaMSUtE_vgVO0aaY6MfLySeTs",
    authDomain: "protea-training-camp.firebaseapp.com",
    projectId: "protea-training-camp",
    storageBucket: "protea-training-camp.appspot.com",
    messagingSenderId: "649833361697",
    appId: "1:649833361697:web:5c402a67872ca10fe30e60",
    measurementId: "G-K1HKHPG6HG"
  };

  // Firebase services
  let auth, dbFirestore, dbRealtime;

  function initializeFirebase() {
    try {
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      
      auth = firebase.auth();
      dbFirestore = firebase.firestore();
      dbRealtime = firebase.database();
      
      auth.onAuthStateChanged(handleAuthStateChanged);
      
      return true;
    } catch (error) {
      console.error("Firebase initialization error:", error);
      showMessage("Could not initialize Firebase. Please refresh or contact support.", "red");
      return false;
    }
  }

  if (typeof firebase !== 'undefined') {
    initializeFirebase();
  } else {
    console.error("Firebase SDK not found. Make sure it's included before this script.");
  }

  // ───────────────────────────────────────────────────────────
  // 3) AUTH STATE HANDLING & USER DATA FETCHING
  // ───────────────────────────────────────────────────────────
  async function handleAuthStateChanged(user) {
    if (user) {
      try {
        const userDoc = await dbFirestore.collection("users").doc(user.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          displayUserInfo(userData);
          checkIfAdmin(user.uid);
          showLoadingIndicators();
          
          await fetchUserScores(user.uid);
          await fetchLeaderboardPosition(user.uid);
          
          setupRealtimeListeners(user.uid);
          updateDoublePointsNotification();
 
          setInterval(updateDoublePointsNotification, 3600000); // Check every hour
        } else {
          console.error("User document not found");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    } else {
      window.location.href = "index.html";
    }
  }

  // ───────────────────────────────────────────────────────────
  // 4) DISPLAY USER INFORMATION
  // ───────────────────────────────────────────────────────────
  function displayUserInfo(userData) {
    if (elements.userName && (userData.username || userData.fullName)) {
      elements.userName.textContent = userData.username || userData.fullName;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 5) CHECK ADMIN STATUS (Optional)
  // ───────────────────────────────────────────────────────────
  async function checkIfAdmin(userId) {
    try {
      const adminDoc = await dbFirestore.collection("admins").doc(userId).get();
      if (adminDoc.exists && elements.adminButton) {
        elements.adminButton.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }

  // ───────────────────────────────────────────────────────────
  // 6) LOADING INDICATORS
  // ───────────────────────────────────────────────────────────
  function showLoadingIndicators() {
    if (elements.weeklyLoading) elements.weeklyLoading.style.display = 'inline-block';
    if (elements.allTimeLoading) elements.allTimeLoading.style.display = 'inline-block';
    if (elements.leaderboardLoading) elements.leaderboardLoading.style.display = 'inline-block';
  }

  function hideLoadingIndicators() {
    if (elements.weeklyLoading) elements.weeklyLoading.style.display = 'none';
    if (elements.allTimeLoading) elements.allTimeLoading.style.display = 'none';
    if (elements.leaderboardLoading) elements.leaderboardLoading.style.display = 'none';
  }

// ───────────────────────────────────────────────────────────
// 7) SCORE CALCULATION & DISPLAY
// ───────────────────────────────────────────────────────────
async function fetchUserScores(userId) {
  try {
    if (!userId) throw new Error("User ID is null or undefined");

    const practiceSubmissionsRef = dbFirestore.collection("users").doc(userId).collection("practice_submissions");
    const dailySubmissionsSnapshot = await practiceSubmissionsRef.get();

    if (dailySubmissionsSnapshot.empty) {
      updateScoreDisplays(0, 0);
      return;
    }
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); 
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    let weeklyScore = 0;
    let allTimeScore = 0;
    
    for (const dailySubmissionDoc of dailySubmissionsSnapshot.docs) {
      const dailySubmissionData = dailySubmissionDoc.data();
      if (dailySubmissionData.isActive === false) continue;
      
      let finalDailyTotal = 0;
      let finalDailyDate = dailySubmissionData.date;
      
      // Use the pre-calculated totalPoints from the daily submission metadata if it exists
      if (typeof dailySubmissionData.totalPoints === 'number') {
          finalDailyTotal = dailySubmissionData.totalPoints;
      }

      allTimeScore += finalDailyTotal;
      
      if (finalDailyDate) {
        const submissionTimestamp = new Date(finalDailyDate);
        submissionTimestamp.setHours(0, 0, 0, 0);
        
        if (submissionTimestamp >= oneWeekAgo && submissionTimestamp <= today) {
          weeklyScore += finalDailyTotal;
        }
      }
    }
    
    updateScoreDisplays(weeklyScore, allTimeScore);
    
  } catch (error) {
    console.error("Error fetching user scores:", error);
    updateScoreDisplays(0, 0);
  }
}

// ───────────────────────────────────────────────────────────
// 8) UPDATE SCORE DISPLAYS
// ───────────────────────────────────────────────────────────
function updateScoreDisplays(weeklyScore, allTimeScore) {
  hideLoadingIndicators();
  
  if (elements.weeklyScoreText) elements.weeklyScoreText.textContent = weeklyScore.toString();
  if (elements.allTimeScoreText) elements.allTimeScoreText.textContent = allTimeScore.toString();
}

// ───────────────────────────────────────────────────────────
// 9) FETCH LEADERBOARD POSITION - WITH NEW MESSAGE TRIGGER
// ───────────────────────────────────────────────────────────
async function fetchLeaderboardPosition(userId) {
  try {
    const usersSnapshot = await dbFirestore.collection("users").get();
    const userScores = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;
      
      if (!userData.username && !userData.fullName) continue;
      if (userData.isDeleted === true || userData.isActive === false) continue;
      
      let totalScore = 0;
      const practiceSubmissionsSnapshot = await dbFirestore.collection("users").doc(uid).collection("practice_submissions").get();
      
      for (const dailySubmissionDoc of practiceSubmissionsSnapshot.docs) {
        const dailyData = dailySubmissionDoc.data();
        if (dailyData.isActive === false) continue;
        if (typeof dailyData.totalPoints === 'number') {
            totalScore += dailyData.totalPoints;
        }
      }
      
      userScores.push({ uid, name: userData.username || userData.fullName, score: totalScore });
    }
    
    userScores.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    
    const userPosition = userScores.findIndex(user => user.uid === userId) + 1;
    
    updateLeaderboardPosition(userPosition);
    
    // NEW: Trigger the encouraging message if user is in top 3
    triggerEncouragingMessage(userPosition);

  } catch (error) {
    console.error("Error fetching leaderboard position:", error);
    updateLeaderboardPosition(0);
  }
}

// ───────────────────────────────────────────────────────────
// 10) UPDATE LEADERBOARD POSITION DISPLAY
// ───────────────────────────────────────────────────────────
function updateLeaderboardPosition(position) {
  if (elements.leaderboardLoading) elements.leaderboardLoading.style.display = 'none';
  
  let displayText = "--";
  if (position > 0) {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = position % 100;
    const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
    displayText = `${position}${suffix}`;
  } else {
    displayText = "Not ranked";
  }
  
  if (elements.leaderboardPositionText) {
    elements.leaderboardPositionText.textContent = displayText;
  }
}

// ───────────────────────────────────────────────────────────
// 12) SETUP REALTIME LISTENERS
// ───────────────────────────────────────────────────────────
function setupRealtimeListeners(userId) {
    const userSubmissionsRef = dbRealtime.ref(`users/${userId}/practice_submissions`);
    userSubmissionsRef.on("value", () => {
      fetchUserScores(userId);
      fetchLeaderboardPosition(userId);
    });
}

// ───────────────────────────────────────────────────────────
// 13) NEW: ENCOURAGING MESSAGE FOR TOP PLAYERS
// ───────────────────────────────────────────────────────────
function triggerEncouragingMessage(position) {
    // Only show if the user is in the top 3 and the message hasn't been shown today
    const today = new Date().toDateString();
    const lastShownDate = localStorage.getItem('encouragingMessageLastShown');

    if (position > 0 && position <= 3 && lastShownDate !== today) {
        const messages = [
            "You're on fire! 🔥", 
            "Top 3! Keep up the great work! 🚀", 
            "In the winner's circle! Amazing! 🏆"
        ];
        const message = messages[Math.floor(Math.random() * messages.length)];

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = 'encouraging-message';
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // Add class to trigger animation
        setTimeout(() => messageDiv.classList.add('show'), 100);

        // Hide and remove after 3 seconds
        setTimeout(() => {
            messageDiv.classList.remove('show');
            setTimeout(() => messageDiv.remove(), 500);
        }, 3000);

        // Remember that the message was shown today
        localStorage.setItem('encouragingMessageLastShown', today);
    }
}


// ───────────────────────────────────────────────────────────
// 14) NEW: DOUBLE POINTS COIN ANIMATION
// ───────────────────────────────────────────────────────────
const specialPointsPeriods = {
  "Putting": [{ start: new Date(2025, 6, 1), end: new Date(2025, 6, 6) }, { start: new Date(2025, 7, 11), end: new Date(2025, 7, 17) }],
  "Chipping": [{ start: new Date(2025, 6, 7), end: new Date(2025, 6, 13) }, { start: new Date(2025, 7, 18), end: new Date(2025, 7, 24) }],
  "Irons & Tee Shot": [{ start: new Date(2025, 6, 14), end: new Date(2025, 6, 20) }, { start: new Date(2025, 7, 4), end: new Date(2025, 7, 10) }],
  "Tournament Prep": [{ start: new Date(2025, 6, 21), end: new Date(2025, 6, 27) }, { start: new Date(2025, 8, 15), end: new Date(2025, 8, 23) }],
  "Mental": [{ start: new Date(2025, 6, 28), end: new Date(2025, 7, 3) }, { start: new Date(2025, 8, 8), end: new Date(2025, 8, 14) }],
  "Fitness": [{ start: new Date(2025, 7, 25), end: new Date(2025, 7, 31) }]
};

function getActiveDoublePointsCategories() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const activeCategories = [];
  
  for (const category in specialPointsPeriods) {
    for (const period of specialPointsPeriods[category]) {
      if (today >= period.start && today <= period.end) {
        activeCategories.push(category);
        break; 
      }
    }
  }
  return activeCategories;
}

function updateDoublePointsNotification() {
  const container = document.getElementById('doublePointsContainer');
  if (!container) return;

  const activeCategories = getActiveDoublePointsCategories();
  
  if (activeCategories.length > 0) {
    const today = new Date().toDateString();
    const lastShownDate = localStorage.getItem('doublePointsCoinLastShown');

    if (lastShownDate !== today) {
      const categoryText = activeCategories.join(', ');
      
      // Create coin
      container.innerHTML = `
        <div class="coin-wrapper">
          <div class="coin">
              <div class="coin-face front">
                  <span>2X</span>
                  <small>${categoryText}</small>
              </div>
              <div class="coin-face back"></div>
          </div>
          <div class="coin-shadow"></div>
        </div>
      `;

      const wrapper = container.querySelector('.coin-wrapper');
      
      // Start "toss in" animation
      wrapper.classList.add('toss-in');
      
      // Set timer for "melt out" animation
      setTimeout(() => {
        wrapper.classList.add('melt-out');
      }, 4000); // Start melting after 4 seconds

      // Remove from DOM after animation finishes
      setTimeout(() => {
        container.innerHTML = '';
      }, 5500); // Total duration of toss + melt

      localStorage.setItem('doublePointsCoinLastShown', today);
    }
  }
}

  // ───────────────────────────────────────────────────────────
  // NAVIGATION & OTHER FUNCTIONS
  // ───────────────────────────────────────────────────────────
  if (elements.navToggle) {
    elements.navToggle.addEventListener('click', () => {
      const navbar = document.querySelector('.navbar');
      navbar.classList.toggle('active');
      elements.navToggle.classList.toggle('active');
    });
  }
});

function submitTasks() { window.location.href = "submit-task.html"; }
function viewLeaderboard() { window.location.href = "leaderboard.html"; }
function viewHistory() { window.location.href = "history.html"; }
function viewTournament() { window.open("https://www.youtube.com/playlist?list=PLk4_nsOUDG273ux1NuupxwnYUoxfWAq2_", "_blank"); }
function viewMatchPlay() { window.location.href = "match-play.html"; }
function viewImportantDates() { window.location.href = "important-dates.html"; }
function viewProSessions() { window.location.href = "pro-range-session.html"; }
function manageTasks() { window.location.href = "manage-tasks.html"; }

function logout() {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut().then(() => {
      window.location.href = "index.html";
    }).catch((error) => console.error("Logout error:", error));
  }
}