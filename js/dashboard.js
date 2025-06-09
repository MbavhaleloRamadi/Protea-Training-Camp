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
          
          // Show loading indicators
          showLoadingIndicators();
          
          // Fetch and calculate scores
          await fetchUserScores(user.uid);
          
          // Fetch user's leaderboard position
          await fetchLeaderboardPosition(user.uid);
          
          // Set up real-time listeners for score updates
          setupRealtimeListeners(user.uid);

          // Initialize double points banner
          updateDoublePointsBanner();
 
          // Update banner every hour in case date changes
          setInterval(updateDoublePointsBanner, 3600000); // 1 hour
        } else {
          console.error("User document not found");
          showMessage("User profile not found. Please contact support.", "red");
          hideLoadingIndicators();
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        showMessage("Error loading user data. Please refresh the page.", "red");
        hideLoadingIndicators();
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
    console.log("Starting fetchUserScores for userId:", userId);
    
    try {
      if (!userId) {
        throw new Error("User ID is null or undefined");
      }

      console.log("Fetching user practice submissions...");
      
      // Get all daily submissions for this user
      const practiceSubmissionsRef = dbFirestore
        .collection("users")
        .doc(userId)
        .collection("practice_submissions");
      
      const dailySubmissionsSnapshot = await practiceSubmissionsRef.get();
      
      console.log("Found", dailySubmissionsSnapshot.docs.length, "daily submission documents");
      
      if (dailySubmissionsSnapshot.empty) {
        console.log("No daily submissions found for user");
        updateScoreDisplays(0, 0);
        return;
      }
      
      // Calculate date range for weekly score (last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0);
      
      let weeklyScore = 0;
      let allTimeScore = 0;
      
      // Process each daily submission
      for (const dailySubmissionDoc of dailySubmissionsSnapshot.docs) {
        const dailySubmissionId = dailySubmissionDoc.id;
        const dailySubmissionData = dailySubmissionDoc.data();
        
        console.log("Processing daily submission:", dailySubmissionId, dailySubmissionData);
        
        // Skip if submission is not active
        if (dailySubmissionData.isActive === false) {
          console.log("Skipping inactive submission:", dailySubmissionId);
          continue;
        }
        
        // Method 1: Use daily submission metadata if available (more efficient)
        if (dailySubmissionData.totalPoints && typeof dailySubmissionData.totalPoints === 'number') {
          const submissionPoints = dailySubmissionData.totalPoints;
          const submissionDate = dailySubmissionData.date;
          
          console.log("Using metadata - Points:", submissionPoints, "Date:", submissionDate);
          
          // Add to all-time score
          allTimeScore += submissionPoints;
          
          // Check if within weekly range
          if (submissionDate) {
            const submissionTimestamp = new Date(submissionDate);
            submissionTimestamp.setHours(0, 0, 0, 0);
            
            if (submissionTimestamp >= oneWeekAgo) {
              weeklyScore += submissionPoints;
              console.log("Added to weekly score:", submissionPoints);
            }
          }
        } else {
          // Method 2: Fallback - Get categories subcollection and sum individual points
          console.log("No metadata found, fetching categories for:", dailySubmissionId);
          
          try {
            const categoriesSnapshot = await practiceSubmissionsRef
              .doc(dailySubmissionId)
              .collection("categories")
              .where('isDeleted', '==', false)
              .get();
            
            console.log("Found", categoriesSnapshot.docs.length, "categories for", dailySubmissionId);
            
            let dailyTotal = 0;
            let dailyDate = null;
            
            categoriesSnapshot.forEach(categoryDoc => {
              const submission = categoryDoc.data();
              const submissionPoints = submission.totalPoints || 0;
              
              // Verify this submission belongs to the current user
              if (submission.userId && submission.userId !== userId) {
                console.log("Skipping category - not for current user");
                return;
              }
              
              dailyTotal += submissionPoints;
              
              // Get date from first category if not set
              if (!dailyDate && submission.date) {
                dailyDate = submission.date;
              }
              
              console.log("Processed category:", submission.category, "Points:", submissionPoints);
            });
            
            // Add to all-time score
            allTimeScore += dailyTotal;
            
            // Check if within weekly range
            if (dailyDate) {
              const submissionTimestamp = new Date(dailyDate);
              submissionTimestamp.setHours(0, 0, 0, 0);
              
              if (submissionTimestamp >= oneWeekAgo) {
                weeklyScore += dailyTotal;
                console.log("Added to weekly score from categories:", dailyTotal);
              }
            }
            
          } catch (categoryError) {
            console.log("Error fetching categories for", dailySubmissionId, ":", categoryError);
            continue;
          }
        }
      }
      
      console.log("Final calculated scores - Weekly:", weeklyScore, "All-time:", allTimeScore);
      
      // Update UI with calculated scores
      updateScoreDisplays(weeklyScore, allTimeScore);
      
    } catch (error) {
      console.error("Error fetching user scores:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      showMessage("Error calculating scores. Please refresh the page.", "red");
      updateScoreDisplays(0, 0);
    }
  }

  // ───────────────────────────────────────────────────────────
  // 8) UPDATE SCORE DISPLAYS
  // ───────────────────────────────────────────────────────────
  function updateScoreDisplays(weeklyScore, allTimeScore) {
    console.log("Updating score displays - Weekly:", weeklyScore, "All-time:", allTimeScore);
    
    // Hide loading indicators
    hideLoadingIndicators();
    
    // Update weekly score
    if (elements.weeklyScoreText) {
      elements.weeklyScoreText.textContent = weeklyScore.toString();
    } else if (elements.weeklyScoreValue) {
      elements.weeklyScoreValue.textContent = weeklyScore.toString();
    }
    
    // Update all-time score
    if (elements.allTimeScoreText) {
      elements.allTimeScoreText.textContent = allTimeScore.toString();
    } else if (elements.allTimeScoreValue) {
      elements.allTimeScoreValue.textContent = allTimeScore.toString();
    }
    
    console.log("Score displays updated successfully");
  }

  // ───────────────────────────────────────────────────────────
// 9) FETCH LEADERBOARD POSITION - FIXED VERSION
// ───────────────────────────────────────────────────────────
async function fetchLeaderboardPosition(userId) {
  try {
    console.log("Fetching leaderboard positions for userId:", userId);
    
    // Get all users
    const usersSnapshot = await dbFirestore.collection("users").get();
    const userScores = [];
    
    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;
      
      // Skip users without necessary data or deleted users
      if (!userData.username && !userData.fullName) {
        console.log(`Skipping user ${uid} - no username or fullName`);
        continue;
      }
      
      // Skip if user is marked as deleted or inactive
      if (userData.isDeleted === true || userData.isActive === false) {
        console.log(`Skipping user ${uid} - marked as deleted or inactive`);
        continue;
      }
      
      let totalScore = 0;
      
      try {
        // Get user's daily submissions
        const practiceSubmissionsSnapshot = await dbFirestore
          .collection("users")
          .doc(uid)
          .collection("practice_submissions")
          .get();
        
        console.log(`User ${uid} has ${practiceSubmissionsSnapshot.docs.length} daily submissions`);
        
        // Calculate total score for this user
        for (const dailySubmissionDoc of practiceSubmissionsSnapshot.docs) {
          const dailyData = dailySubmissionDoc.data();
          
          // Skip inactive submissions
          if (dailyData.isActive === false) {
            console.log(`Skipping inactive daily submission for user ${uid}`);
            continue;
          }
          
          if (dailyData.totalPoints && typeof dailyData.totalPoints === 'number') {
            // Use metadata if available
            totalScore += dailyData.totalPoints;
            console.log(`Added ${dailyData.totalPoints} points from metadata for user ${uid}`);
          } else {
            // Fallback: sum from categories
            try {
              const categoriesSnapshot = await dbFirestore
                .collection("users")
                .doc(uid)
                .collection("practice_submissions")
                .doc(dailySubmissionDoc.id)
                .collection("categories")
                .where('isDeleted', '==', false)
                .get();
              
              let dailyTotal = 0;
              categoriesSnapshot.forEach(categoryDoc => {
                const submission = categoryDoc.data();
                
                // Make sure this category submission belongs to this user
                if (submission.userId && submission.userId !== uid) {
                  console.log(`Skipping category - belongs to different user: ${submission.userId} vs ${uid}`);
                  return;
                }
                
                const submissionPoints = submission.totalPoints || 0;
                dailyTotal += submissionPoints;
              });
              
              totalScore += dailyTotal;
              console.log(`Added ${dailyTotal} points from categories for user ${uid}`);
              
            } catch (categoryError) {
              console.log(`Error processing categories for user ${uid}:`, categoryError);
            }
          }
        }
        
      } catch (userError) {
        console.log(`Error processing user ${uid}:`, userError);
        continue;
      }
      
      // Only add users with valid scores to the leaderboard
      if (totalScore >= 0) {
        userScores.push({
          uid,
          name: userData.username || userData.fullName,
          score: totalScore
        });
        
        console.log(`User ${uid} (${userData.username || userData.fullName}) has total score: ${totalScore}`);
      }
    }
    
    // Sort by score (descending) - users with same score will maintain their relative order
    userScores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // If scores are equal, sort by name for consistency
      return a.name.localeCompare(b.name);
    });
    
    console.log("Final leaderboard (top 10):", userScores.slice(0, 10));
    
    // Find current user's position
    const userPosition = userScores.findIndex(user => user.uid === userId) + 1;
    
    // Double-check: log the current user's score and position
    const currentUserData = userScores.find(user => user.uid === userId);
    if (currentUserData) {
      console.log(`Current user (${currentUserData.name}) score: ${currentUserData.score}, position: ${userPosition}`);
      
      // Log users around current user's position for context
      const start = Math.max(0, userPosition - 3);
      const end = Math.min(userScores.length, userPosition + 2);
      console.log("Users around current user's position:", userScores.slice(start, end));
    } else {
      console.log("Current user not found in leaderboard");
    }
    
    // Update UI
    updateLeaderboardPosition(userPosition);
    
    console.log("Final user position:", userPosition);
    
  } catch (error) {
    console.error("Error fetching leaderboard position:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    updateLeaderboardPosition(0);
  }
}

  // ───────────────────────────────────────────────────────────
  // 10) UPDATE LEADERBOARD POSITION DISPLAY
  // ───────────────────────────────────────────────────────────
  function updateLeaderboardPosition(position) {
    // Hide loading indicator
    if (elements.leaderboardLoading) {
      elements.leaderboardLoading.style.display = 'none';
    }
    
    let displayText = "--";
    
    if (position > 0) {
      const suffix = getOrdinalSuffix(position);
      displayText = `${position}${suffix}`;
    } else {
      displayText = "Not ranked";
    }
    
    // Update position display
    if (elements.leaderboardPositionText) {
      elements.leaderboardPositionText.textContent = displayText;
    } else if (elements.leaderboardPositionValue) {
      elements.leaderboardPositionValue.textContent = displayText;
    }
    
    console.log("Leaderboard position updated:", displayText);
  }

  // ───────────────────────────────────────────────────────────
  // 11) HELPER FUNCTIONS
  // ───────────────────────────────────────────────────────────
  function getOrdinalSuffix(num) {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = num % 100;
    return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
  }

  // ───────────────────────────────────────────────────────────
  // 12) SETUP REALTIME LISTENERS
  // ───────────────────────────────────────────────────────────
  function setupRealtimeListeners(userId) {
    console.log("Setting up realtime listeners for userId:", userId);
    
    // Set up Realtime Database listener for score updates
    const userSubmissionsRef = dbRealtime.ref(`users/${userId}/practice_submissions`);
    
    userSubmissionsRef.on("value", (snapshot) => {
      console.log("Realtime update received for practice submissions");
      
      // Re-fetch and calculate scores when data changes
      fetchUserScores(userId);
      fetchLeaderboardPosition(userId);
    });
    
    // Also listen for global leaderboard changes (if you maintain a global leaderboard)
    const leaderboardRef = dbRealtime.ref('leaderboard');
    
    leaderboardRef.on("value", (snapshot) => {
      console.log("Leaderboard update received");
      fetchLeaderboardPosition(userId);
    });
    
    // Optional: Listen to daily submissions collection changes in Firestore
    // This provides more granular updates
    const practiceSubmissionsRef = dbFirestore
      .collection("users")
      .doc(userId)
      .collection("practice_submissions");
    
    // Note: Firestore realtime listeners can be expensive, use sparingly
    const unsubscribe = practiceSubmissionsRef.onSnapshot((snapshot) => {
      console.log("Firestore practice submissions updated");
      
      // Debounce the score update to avoid too many calls
      clearTimeout(window.scoreUpdateTimeout);
      window.scoreUpdateTimeout = setTimeout(() => {
        fetchUserScores(userId);
        fetchLeaderboardPosition(userId);
      }, 1000);
    });
    
    // Store unsubscribe function for cleanup
    window.firestoreUnsubscribe = unsubscribe;
  }

  // ───────────────────────────────────────────────────────────
  // 13) CLEANUP FUNCTION
  // ───────────────────────────────────────────────────────────
  function cleanupRealtimeListeners() {
    // Clean up Firestore listener
    if (window.firestoreUnsubscribe) {
      window.firestoreUnsubscribe();
      window.firestoreUnsubscribe = null;
    }
    
    // Clean up timeout
    if (window.scoreUpdateTimeout) {
      clearTimeout(window.scoreUpdateTimeout);
      window.scoreUpdateTimeout = null;
    }
    
    // Note: Realtime Database listeners should be cleaned up manually
    // if you need to remove them (e.g., on user logout)
  }
  
// ───────────────────────────────────────────────────────────
// DOUBLE POINTS SYSTEM
// ───────────────────────────────────────────────────────────

// Helper function to create dates (months are 0-indexed in JS)
function createDate(year, month, day) {
  return new Date(year, month - 1, day); // Subtract 1 from month
}

// Helper function to check if date is in range
function isDateInRange(date, start, end) {
  return date >= start && date <= end;
}

// Special points periods for each category
const specialPointsPeriods = {
  "Putting": [
    { start: createDate(2025, 7, 1), end: createDate(2025, 7, 6) },
    { start: createDate(2025, 8, 11), end: createDate(2025, 8, 17) }
  ],
  "Chipping": [
    { start: createDate(2025, 7, 7), end: createDate(2025, 7, 13) },
    { start: createDate(2025, 8, 18), end: createDate(2025, 8, 24) }
  ],
  "Irons & Tee Shot": [
    { start: createDate(2025, 7, 14), end: createDate(2025, 7, 20) },
    { start: createDate(2025, 8, 4), end: createDate(2025, 8, 10) }
  ],
  "Tournament Prep": [
    { start: createDate(2025, 7, 21), end: createDate(2025, 7, 27) },
    { start: createDate(2025, 9, 15), end: createDate(2025, 9, 23) }
  ],
  "Mental": [
    { start: createDate(2025, 7, 28), end: createDate(2025, 8, 3) },
    { start: createDate(2025, 9, 8), end: createDate(2025, 9, 14) }
  ],
  "Fitness": [
    { start: createDate(2025, 8, 25), end: createDate(2025, 8, 31) }
  ]
};

// Tournament days (no submissions allowed)
const tournamentStart = createDate(2025, 9, 24);
const tournamentEnd = createDate(2025, 9, 28);

// Function to check if double points apply for a category on a specific date
function shouldDoublePoints(category, date) {
  if (!specialPointsPeriods[category]) return false;
  
  return specialPointsPeriods[category].some(period => 
    isDateInRange(date, period.start, period.end)
  );
}

// Function to check if submissions are allowed (not tournament days)
function areSubmissionsAllowed(date) {
  return !(isDateInRange(date, tournamentStart, tournamentEnd));
}

// Function to get active double points categories for today
function getActiveDoublePointsCategories() {
  const today = new Date();
  const activeCategories = [];
  
  Object.keys(specialPointsPeriods).forEach(category => {
    if (shouldDoublePoints(category, today)) {
      activeCategories.push(category);
    }
  });
  
  return activeCategories;
}

// Function to show/hide double points banner
function updateDoublePointsBanner() {
  const banner = document.getElementById('doublePointsBanner');
  const flagMainText = document.getElementById('flagMainText');
  const flagCategory = document.getElementById('flagCategory');
  
  if (!banner || !flagMainText || !flagCategory) return;
  
  const activeCategories = getActiveDoublePointsCategories();
  
  if (activeCategories.length > 0) {
    // Show banner with active categories
    const categoryText = activeCategories.length === 1 
      ? activeCategories[0]
      : `${activeCategories.length} Categories`;
    
    flagMainText.textContent = '2X POINTS!';
    flagCategory.textContent = categoryText;
    banner.classList.add('active');
    
    console.log('Double points active for:', activeCategories);
  } else {
    // Hide banner
    banner.classList.remove('active');
  }
}

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

// ───────────────────────────────────────────────────────────
// Updated Nav Functions
// ───────────────────────────────────────────────────────────

// Navigation functionality for golf dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Get navigation elements
    const navLinks = document.querySelectorAll('.navbar a');
    
    // Handle active link clicks
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Set active link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Toggle mobile navbar visibility
const navToggleBtn = document.getElementById('navToggle');
const navbar = document.querySelector('.navbar');

if (navToggleBtn && navbar) {
    navToggleBtn.addEventListener('click', function () {
        navbar.classList.toggle('active');
    });
  }
    
    // Set initial active state based on current page
    function setInitialActiveLink() {
        // Get current page URL
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Find matching link or default to first
        let activeLink = null;
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.includes(currentPage)) {
                activeLink = link;
            }
        });
        
        // If no matching link found, set first as active
        if (!activeLink && navLinks.length > 0) {
            activeLink = navLinks[0];
        }
        
        // Apply active class
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
    
    setInitialActiveLink();
    
    // Add shimmer effect to nav items
    function addShimmerEffect() {
        const navItems = document.querySelectorAll('.navbar li a');
        
        navItems.forEach(item => {
            item.addEventListener('mouseenter', function() {
                // Remove any existing shimmers first
                const existingShimmers = this.querySelectorAll('.nav-shimmer');
                existingShimmers.forEach(s => s.remove());
                
                const shimmer = document.createElement('div');
                shimmer.className = 'nav-shimmer';
                
                // Ensure item has relative position for absolute positioning of shimmer
                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                this.appendChild(shimmer);
                
                setTimeout(() => {
                    shimmer.remove();
                }, 1000);
            });
        });
    }
    
    addShimmerEffect();

    // Mobile UX: dimmed overlay focus for nav
    function setupMobileNavOverlay() {
        const overlay = document.createElement('div');
        overlay.classList.add('mobile-nav-overlay');
        document.body.appendChild(overlay);

        const nav = document.querySelector('.navbar');
        const navLinks = nav.querySelectorAll('a');

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                overlay.classList.remove('active');
            });

            link.addEventListener('touchstart', () => {
                overlay.classList.add('active');
                setTimeout(() => overlay.classList.remove('active'), 1000);
            });
        });

        overlay.addEventListener('click', () => {
            overlay.classList.remove('active');
        });
    }

    // Handle overflow scrolling for mobile
    function handleScrolling() {
        if (window.innerWidth <= 768) {
            const navbar = document.querySelector('.navbar ul');
            
            // Check if there's overflow
            if (navbar.scrollWidth > navbar.clientWidth) {
                // Add tactile feedback (subtle scrolling indicators)
                navbar.style.paddingLeft = '8px';
                navbar.style.paddingRight = '8px';
                
                // Add smooth scrolling behavior
                navbar.style.scrollBehavior = 'smooth';
                
                // Optional: Add scroll snap
                navbar.style.scrollSnapType = 'x mandatory';
                
                // Add snap points to nav items
                const navItems = navbar.querySelectorAll('li');
                navItems.forEach(item => {
                    item.style.scrollSnapAlign = 'center';
                });
            }
        }
    }
    
    // Run on load and resize
    handleScrolling();
    window.addEventListener('resize', handleScrolling);

    
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
  window.open("https://www.youtube.com/playlist?list=PLk4_nsOUDG273ux1NuupxwnYUoxfWAq2_", "_blank");
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