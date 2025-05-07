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
    todayScoreValue: document.getElementById("today-score-value"),
    weeklyScoreValue: document.getElementById("weekly-score-value"),
    allTimeScoreValue: document.getElementById("all-time-score-value"),
    
    // Admin button
    adminButton: document.getElementById("admin-button"),
    
    // Confirmation message
    confirmEl: document.getElementById("confirmationMessage")
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
      window.location.href = "login.html";
    }
  }

  // ───────────────────────────────────────────────────────────
  // 4) DISPLAY USER INFORMATION
  // ───────────────────────────────────────────────────────────
  function displayUserInfo(userData) {
    if (elements.userName && userData.fullName) {
      // Get first name (for personalization)
      const firstName = userData.fullName.split(" ")[0];
      elements.userName.textContent = firstName;
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
        updateScoreDisplays(0, 0, 0);
        return;
      }
      
      // Calculate scores
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      let todayScore = 0;
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
        if (submissionDate === today) {
          todayScore += submissionPoints;
        }
        
        const submissionTimestamp = new Date(submissionDate);
        if (submissionTimestamp >= oneWeekAgo) {
          weeklyScore += submissionPoints;
        }
        
        allTimeScore += submissionPoints;
      });
      
      // Update UI with calculated scores
      updateScoreDisplays(todayScore, weeklyScore, allTimeScore);
      
    } catch (error) {
      console.error("Error fetching user scores:", error);
      showMessage("Error calculating scores. Please refresh the page.", "red");
    }
  }

  // ───────────────────────────────────────────────────────────
  // 7) UPDATE SCORE DISPLAYS
  // ───────────────────────────────────────────────────────────
  function updateScoreDisplays(today, weekly, allTime) {
    if (elements.todayScoreValue) {
      elements.todayScoreValue.textContent = today;
    }
    
    if (elements.weeklyScoreValue) {
      elements.weeklyScoreValue.textContent = weekly;
    }
    
    if (elements.allTimeScoreValue) {
      elements.allTimeScoreValue.textContent = allTime;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 8) SETUP REALTIME LISTENERS
  // ───────────────────────────────────────────────────────────
  function setupRealtimeListeners(userId) {
    // Set up Realtime Database listener for score updates
    const userSubmissionsRef = dbRealtime.ref(`users/${userId}/task_submissions`);
    
    userSubmissionsRef.on("value", (snapshot) => {
      console.log("Realtime update received");
      
      // Re-fetch and calculate scores when data changes
      fetchUserScores(userId);
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

function manageTasks() {
  window.location.href = "manage-tasks.html";
}

// Logout function
function logout() {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().signOut()
      .then(() => {
        window.location.href = "login.html";
      })
      .catch((error) => {
        console.error("Logout error:", error);
      });
  } else {
    console.error("Firebase auth not initialized for logout");
    window.location.href = "login.html";
  }
}