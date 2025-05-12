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

  // Initialize Firebase - improved error handling
  function initializeFirebase() {
    try {
      // Check if Firebase is already initialized
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      
      // Initialize Firebase services
      auth = firebase.auth();
      dbFirestore = firebase.firestore();
      dbRealtime = firebase.database();
      
      // Monitor auth state changes
      auth.onAuthStateChanged(handleAuthStateChanged);
      
      return true;
    } catch (error) {
      console.error("Firebase initialization error:", error);
      showMessage("Could not initialize Firebase. Please refresh or contact support.", "red");
      return false;
    }
  }

  // Ensure Firebase SDK is loaded before initializing
  if (typeof firebase !== 'undefined') {
    initializeFirebase();
  } else {
    console.error("Firebase SDK not found. Make sure it's included before this script.");
    showMessage("Firebase SDK not found. Please refresh or contact support.", "red");
    
    // Optional: Add a retry mechanism with a small delay
    const maxRetries = 3;
    let retryCount = 0;
    
    const retryInterval = setInterval(() => {
      retryCount++;
      console.log(`Retrying Firebase initialization (${retryCount}/${maxRetries})...`);
      
      if (typeof firebase !== 'undefined') {
        clearInterval(retryInterval);
        initializeFirebase();
      } else if (retryCount >= maxRetries) {
        clearInterval(retryInterval);
        console.error("Firebase SDK could not be loaded after multiple attempts.");
      }
    }, 1000); // Retry every second
  }

  // ───────────────────────────────────────────────────────────
  // 3) AUTH STATE HANDLING & USER DATA FETCHING
  // ───────────────────────────────────────────────────────────
  async function handleAuthStateChanged(user) {
    if (user) {
      console.log("User is logged in:", user.uid);
      
      try {
        // Fetch user data from Firestore
        const userDoc = await dbFirestore.collection("users").doc(user.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          
          // Update UI with user info
          displayUserInfo(userData);
          
          // Check if admin (optional feature)
          checkIfAdmin(user.uid);
          
          // Fetch and calculate scores
          fetchUserScores(user.uid);
          
          // Fetch user's leaderboard position
          fetchLeaderboardPosition(user.uid);
          
          // Set up real-time listeners for score updates
          setupRealtimeListeners(user.uid);
        } else {
          console.error("User document not found");
          showMessage("User profile not found. Please contact support.", "red");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        showMessage("Error loading user data. Please refresh the page.", "red");
      }
    } else {
      // User is not logged in, redirect to login page
      console.log("User is not logged in, redirecting...");
      window.location.href = "index.html";
    }
  }

  // ───────────────────────────────────────────────────────────
  // 4) DISPLAY USER INFORMATION
  // ───────────────────────────────────────────────────────────
  function displayUserInfo(userData) {
    if (elements.userName && userData.username) {
      // Use username instead of fullName
      elements.userName.textContent = userData.username;
    } else if (elements.userName && userData.fullName) {
      // Fallback to fullName if username doesn't exist
      elements.userName.textContent = userData.fullName;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 5) CHECK ADMIN STATUS (Optional)
  // ───────────────────────────────────────────────────────────
  async function checkIfAdmin(userId) {
    try {
      // Check if user is in admins collection
      const adminDoc = await dbFirestore.collection("admins").doc(userId).get();
      
      if (adminDoc.exists && elements.adminButton) {
        // Show admin button if user is an admin
        elements.adminButton.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }

  // ───────────────────────────────────────────────────────────
  // 6) FETCH & CALCULATE USER SCORES
  // ───────────────────────────────────────────────────────────
  async function fetchUserScores(userId) {
    try {
      // Get all task submissions for the user
      const submissionsSnapshot = await dbFirestore
        .collection("users")
        .doc(userId)
        .collection("task_submissions")
        .orderBy("timestamp", "desc")
        .get();
      
      if (submissionsSnapshot.empty) {
        console.log("No task submissions found");
        updateScoreDisplays(0, 0);
        return;
      }
      
      // Calculate scores
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      let weeklyScore = 0;
      let allTimeScore = 0;
      
      submissionsSnapshot.forEach(doc => {
        const submission = doc.data();
        const submissionDate = submission.date;
        const practices = submission.practices || [];
        
        // Calculate points from this submission
        const submissionPoints = practices.reduce((total, practice) => {
          return total + (practice.points || 0);
        }, 0);
        
        // Add to appropriate counters
        const submissionTimestamp = new Date(submissionDate);
        if (submissionTimestamp >= oneWeekAgo) {
          weeklyScore += submissionPoints;
        }
        
        allTimeScore += submissionPoints;
      });
      
      // Update UI with calculated scores
      updateScoreDisplays(weeklyScore, allTimeScore);
      
    } catch (error) {
      console.error("Error fetching user scores:", error);
      showMessage("Error calculating scores. Please refresh the page.", "red");
    }
  }

  // ───────────────────────────────────────────────────────────
  // 7) FETCH LEADERBOARD POSITION
  // ───────────────────────────────────────────────────────────
  async function fetchLeaderboardPosition(userId) {
    try {
      // Get all users and their scores
      const usersSnapshot = await dbFirestore.collection("users").get();
      const userScores = [];
      
      // Process each user
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const uid = userDoc.id;
        
        // Skip users without necessary data
        if (!userData.username && !userData.fullName) continue;
        
        // Get user's submissions
        const submissionsSnapshot = await dbFirestore
          .collection("users")
          .doc(uid)
          .collection("task_submissions")
          .get();
        
        // Calculate total score
        let totalScore = 0;
        submissionsSnapshot.forEach(doc => {
          const submission = doc.data();
          const practices = submission.practices || [];
          
          const submissionPoints = practices.reduce((total, practice) => {
            return total + (practice.points || 0);
          }, 0);
          
          totalScore += submissionPoints;
        });
        
        // Add to scores array
        userScores.push({
          uid,
          name: userData.username || userData.fullName,
          score: totalScore
        });
      }
      
      // Sort by score (descending)
      userScores.sort((a, b) => b.score - a.score);
      
      // Find current user's position
      const userPosition = userScores.findIndex(user => user.uid === userId) + 1;
      
      // Update UI
      if (elements.leaderboardPositionValue) {
        if (userPosition > 0) {
          const suffix = getOrdinalSuffix(userPosition);
          elements.leaderboardPositionValue.textContent = `${userPosition}${suffix}`;
        } else {
          elements.leaderboardPositionValue.textContent = "Not ranked";
        }
      }
      
    } catch (error) {
      console.error("Error fetching leaderboard position:", error);
      if (elements.leaderboardPositionValue) {
        elements.leaderboardPositionValue.textContent = "--";
      }
    }
  }

  // Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
  function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) {
      return "st";
    }
    if (j === 2 && k !== 12) {
      return "nd";
    }
    if (j === 3 && k !== 13) {
      return "rd";
    }
    return "th";
  }

  // ───────────────────────────────────────────────────────────
  // 8) UPDATE SCORE DISPLAYS
  // ───────────────────────────────────────────────────────────
  function updateScoreDisplays(weekly, allTime) {
    if (elements.weeklyScoreValue) {
      elements.weeklyScoreValue.textContent = weekly;
    }
    
    if (elements.allTimeScoreValue) {
      elements.allTimeScoreValue.textContent = allTime;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 9) SETUP REALTIME LISTENERS
  // ───────────────────────────────────────────────────────────
  function setupRealtimeListeners(userId) {
    // Set up Realtime Database listener for score updates
    const userSubmissionsRef = dbRealtime.ref(`users/${userId}/task_submissions`);
    
    userSubmissionsRef.on("value", (snapshot) => {
      console.log("Realtime update received");
      
      // Re-fetch and calculate scores when data changes
      fetchUserScores(userId);
      fetchLeaderboardPosition(userId);
    });
    
    // Also listen for global leaderboard changes
    const leaderboardRef = dbRealtime.ref('leaderboard');
    
    leaderboardRef.on("value", (snapshot) => {
      console.log("Leaderboard update received");
      fetchLeaderboardPosition(userId);
    });
  }

  // ───────────────────────────────────────────────────────────
  // Helper Functions
  // ───────────────────────────────────────────────────────────
  
  // Show confirmation/alert messages
  function showMessage(message, color) {
    if (!elements.confirmEl) return;
    
    elements.confirmEl.textContent = message;
    elements.confirmEl.style.color = color;
    elements.confirmEl.style.backgroundColor =
      color === "green" ? "rgba(40,167,69,0.2)" :
      color === "red"   ? "rgba(220,53,69,0.2)" :
      color === "blue"  ? "rgba(13,110,253,0.2)" :
      "rgba(255,193,7,0.2)";
    elements.confirmEl.classList.remove("hidden");
    
    // Auto-hide non-error messages after 5 seconds
    if (color !== "red") {
      setTimeout(() => {
        elements.confirmEl.classList.add("hidden");
      }, 5000);
    }
  }
  
  // Initialize mobile navigation toggle
  if (elements.navToggle) {
    elements.navToggle.addEventListener('click', () => {
      const navbar = document.querySelector('.navbar');
      navbar.classList.toggle('active');
      elements.navToggle.classList.toggle('active');
    });
  }
});

  // ───────────────────────────────────────────────────────────
  // Pro Range Session 
  // ───────────────────────────────────────────────────────────

// Wait for the DOM to load before adding event listeners
document.addEventListener("DOMContentLoaded", () => {
  const profileButton = document.getElementById("kriekProfileBtn");

  // Open Kriek's profile in a new tab when button is clicked
  profileButton.addEventListener("click", () => {
    window.open("https://sunshinetour.com/playerprofile/KRI012", "_blank");
  });
});

// Navigation Functions
function submitTasks() {
  window.location.href = "submit-task.html";
}

function viewLeaderboard() {
  window.location.href = "leaderboard.html";
}

function viewHistory() {
  window.location.href = "history.html";
}

function viewTournament() {
  window.location.href = "tournament.html";
}

function viewMatchPlay() {
  window.location.href = "match-play.html";
}

function viewImportantDates() {
  window.location.href = "important-dates.html";
}

function viewProSessions() {
  window.location.href = "pro-range-session.html";
}

function manageTasks() {
  window.location.href = "manage-tasks.html";
}

// Logout function
function logout() {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut()
      .then(() => {
        window.location.href = "index.html";
      })
      .catch((error) => {
        console.error("Logout error:", error);
      });
  } else {
    console.error("Firebase auth not initialized for logout");
    window.location.href = "index.html";
  }
}