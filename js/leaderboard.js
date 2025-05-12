document.addEventListener("DOMContentLoaded", () => {
    // ───────────────────────────────────────────────────────────
    // DOM Elements - Define all DOM elements at the start
    // ───────────────────────────────────────────────────────────
    const elements = {
      // Loader elements
      loader: document.querySelector(".loader-overlay"),
      
      // Leaderboard elements
      leaderboardContainer: document.getElementById("leaderboardData"),
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
  
    try {
      if (window.firebase) {
        firebase.initializeApp(firebaseConfig);
        
        // Initialize Firebase services
        auth = firebase.auth();
        dbFirestore = firebase.firestore();
        dbRealtime = firebase.database();
        
        // Auth state changes
        auth.onAuthStateChanged(handleAuthStateChanged);
      } else {
        console.error("Firebase SDK not found. Make sure it's included before this script.");
        showError("Firebase SDK not found. Please refresh or contact support.");
        return; // halt further setup
      }
    } catch (error) {
      console.error("Firebase initialization error:", error);
      showError("Could not initialize Firebase. Please refresh or contact support.");
      return;
    }
  
    // ───────────────────────────────────────────────────────────
    // 3) AUTH STATE CHANGE HANDLER
    // ───────────────────────────────────────────────────────────
    function handleAuthStateChanged(user) {
      if (user) {
        console.log("User is logged in");
        // Initialize the leaderboard
        initializeLeaderboard();
      } else {
        console.log("User is not logged in, redirecting to login");
        window.location.href = "login.html";
      }
    }
  
    // ───────────────────────────────────────────────────────────
    // 4) LEADERBOARD INITIALIZATION
    // ───────────────────────────────────────────────────────────
    function initializeLeaderboard() {
      if (!elements.leaderboardContainer) return;
  
      // Display loading state
      showLoading();
  
      // Setup real-time listener for all users
      setupRealtimeLeaderboard();
    }
  
    function showLoading() {
      if (elements.leaderboardContainer) {
        elements.leaderboardContainer.innerHTML = `
          <div class="loading-data">
            <div class="loading-spinner"></div>
            <p>Loading leaderboard data...</p>
          </div>
        `;
      }
    }
  
    function showError(message) {
      if (elements.leaderboardContainer) {
        elements.leaderboardContainer.innerHTML = `
          <div class="error-message">
            <p>${escapeHtml(message)}</p>
          </div>
        `;
      }
    }
  
    // ───────────────────────────────────────────────────────────
    // 5) REALTIME LEADERBOARD SETUP
    // ───────────────────────────────────────────────────────────
    function setupRealtimeLeaderboard() {
      // Use Realtime Database for live updates
      const usersRef = dbRealtime.ref("users");
      
      // Listen for value changes
      usersRef.on("value", (snapshot) => {
        try {
          if (!snapshot.exists()) {
            elements.leaderboardContainer.innerHTML = "<div class='no-data'>No leaderboard data available yet.</div>";
            return;
          }
          
          const usersData = snapshot.val();
          processLeaderboardData(usersData);
        } catch (error) {
          console.error("Error processing leaderboard data:", error);
          showError("Error loading leaderboard. Please refresh the page.");
        }
      }, (error) => {
        console.error("Database error:", error);
        showError("Database connection error. Please try again later.");
      });
    }
  
// ───────────────────────────────────────────────────────────
// 6) DATA PROCESSING - UPDATED FOR POINTS SORTING
// ───────────────────────────────────────────────────────────
function processLeaderboardData(usersData) {
  // Convert users data to array for sorting
  const leaderboardEntries = [];
  
  // Process each user
  Object.keys(usersData).forEach(userId => {
    const userData = usersData[userId];
    
    // Skip users without necessary data
    if (!userData.username) return; // Changed from fullName to username
    
    // Calculate total score from task submissions
    // Higher points are better
    let totalScore = 0;
    let roundsPlayed = 0;
    let latestSubmissionTime = 0; // For tiebreaker
    
    if (userData.task_submissions) {
      Object.values(userData.task_submissions).forEach(submission => {
        if (submission.practices && Array.isArray(submission.practices)) {
          submission.practices.forEach(practice => {
            if (practice.points !== undefined) {
              totalScore += parseInt(practice.points) || 0;
              roundsPlayed++;
              
              // Keep track of the latest submission time for tiebreaker
              if (practice.submissionTime) {
                const submissionTime = parseInt(practice.submissionTime) || 0;
                if (submissionTime > latestSubmissionTime) {
                  latestSubmissionTime = submissionTime;
                }
              }
            }
          });
        }
      });
    }
    
    // Format the score for display
    const formattedScore = roundsPlayed > 0 ? totalScore.toString() : "N/A";
    
    // Add to leaderboard entries
    leaderboardEntries.push({
      userId: userId,
      name: userData.username, // Changed from fullName to username
      rawScore: totalScore,
      displayScore: formattedScore,
      roundsPlayed: roundsPlayed,
      latestSubmissionTime: latestSubmissionTime
    });
  });
  
  // Sort by score (highest first for points)
  leaderboardEntries.sort((a, b) => {
    // If a player hasn't played, they should be at the bottom
    if (a.roundsPlayed === 0 && b.roundsPlayed > 0) return 1;
    if (b.roundsPlayed === 0 && a.roundsPlayed > 0) return -1;
    
    // Sort by score (higher is better for points)
    if (b.rawScore !== a.rawScore) {
      return b.rawScore - a.rawScore;
    }
    
    // Tiebreaker: earlier submission time ranks higher
    return a.latestSubmissionTime - b.latestSubmissionTime;
  });
  
  // Render sorted leaderboard
  renderLeaderboard(leaderboardEntries);
}
  
    // ───────────────────────────────────────────────────────────
    // 7) RENDER LEADERBOARD - UPDATED FOR GOLF DISPLAY
    // ───────────────────────────────────────────────────────────
    function renderLeaderboard(entries) {
      // Clear current content
      elements.leaderboardContainer.innerHTML = "";
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      if (entries.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "no-data";
        emptyMessage.textContent = "No leaderboard data available yet.";
        fragment.appendChild(emptyMessage);
      } else {
        // Add each entry with rank
        entries.forEach((entry, index) => {
          const rank = index + 1;
          const row = createLeaderboardRow(rank, entry);
          fragment.appendChild(row);
        });
      }
      
      // Single DOM update with all rows
      elements.leaderboardContainer.appendChild(fragment);
      
      // Hide loader if still visible
      if (elements.loader) {
        elements.loader.style.display = "none";
      }
    }
  
    function createLeaderboardRow(rank, entry) {
      const row = document.createElement("div");
      row.classList.add("leaderboard-row");
      
      // Add highlight class for top 3
      if (rank <= 3) {
        row.classList.add(`rank-${rank}`);
      }
      
      // Highlight current user
      const currentUser = auth.currentUser;
      if (currentUser && entry.userId === currentUser.uid) {
        row.classList.add("current-user");
      }
      
      // Create HTML structure that matches the header columns in the HTML
      row.innerHTML = `
        <div class="rank">${rank}</div>
        <div class="name">${escapeHtml(entry.name)}</div>
        <div class="score">${entry.displayScore}</div>
      `;
      
      return row;
    }
  
    // ───────────────────────────────────────────────────────────
    // HELPER FUNCTIONS
    // ───────────────────────────────────────────────────────────
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      if (!text) return "";
      
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // Function to create a leaderboard row
function createLeaderboardRow(rank, entry) {
    const row = document.createElement("div");
    row.classList.add("leaderboard-row");
    
    // Add highlight class for top 3
    if (rank <= 3) {
      row.classList.add(`rank-${rank}`);
    }
    
    // Highlight current user
    const currentUser = auth.currentUser;
    if (currentUser && entry.userId === currentUser.uid) {
      row.classList.add("current-user");
    }
    
    // Create HTML structure that matches the header columns in the HTML
    // Each div corresponds to a column in the grid layout
    const rankDiv = document.createElement("div");
    rankDiv.className = "rank";
    rankDiv.textContent = rank;
    
    const nameDiv = document.createElement("div");
    nameDiv.className = "name";
    nameDiv.textContent = escapeHtml(entry.name);
    
    const scoreDiv = document.createElement("div");
    scoreDiv.className = "score";
    scoreDiv.textContent = entry.displayScore;
    
    // Add each column div to the row
    row.appendChild(rankDiv);
    row.appendChild(nameDiv);
    row.appendChild(scoreDiv);
    
    return row;
  }
  });