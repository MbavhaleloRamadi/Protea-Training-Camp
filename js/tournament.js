document.addEventListener("DOMContentLoaded", () => {
  // ───────────────────────────────────────────────────────────
  // DOM Elements - Define all DOM elements at the start
  // ───────────────────────────────────────────────────────────
  const elements = {
    // Tournament page elements
    countdown: document.getElementById("countdown"),
    joinButton: document.getElementById("joinNowBtn"),
    cancelButton: document.getElementById("cancelBtn"),
    tournamentContainer: document.getElementById("tournamentContainer"),
    previewContainer: document.getElementById("previewContainer"),
    backToDashboardBtn: document.getElementById("backToDashboardBtn"),
    
    // Loader elements
    loader: document.querySelector(".loader-overlay")
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
  // NOTE: In production, you should use environment variables for these values
  // and load them via a build process rather than including them directly in client code
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
      
      // Monitor auth‑state changes
      auth.onAuthStateChanged(user => {
        console.log(user ? "User is logged in" : "User is not logged in");
        
        // If user is not logged in, redirect to login page
        if (!user && window.location.pathname.includes("tournament.html")) {
          showMessage("Please log in to join the tournament", "red");
          setTimeout(() => {
            window.location.href = "login.html";
          }, 2000);
        }
      });
    } else {
      console.error("Firebase SDK not found. Make sure it's included before this script.");
      showMessage("Firebase SDK not found. Please refresh or contact support.", "red");
      return; // halt further setup
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
    showMessage("Could not initialize Firebase. Please refresh or contact support.", "red");
    return;
  }

  // ───────────────────────────────────────────────────────────
  // 3) COUNTDOWN TIMER
  // ───────────────────────────────────────────────────────────
  let countdownSeconds = 10;
  let countdownInterval;

  function startCountdown() {
    if (elements.countdown) {
      countdownInterval = setInterval(() => {
        countdownSeconds--;
        elements.countdown.textContent = countdownSeconds;
        
        if (countdownSeconds <= 0) {
          clearInterval(countdownInterval);
          handleTournamentStart();
        }
      }, 1000);
    }
  }

  // Start the countdown when page loads
  startCountdown();

  // ───────────────────────────────────────────────────────────
  // 4) TOURNAMENT BUTTONS
  // ───────────────────────────────────────────────────────────
  if (elements.joinButton) {
    elements.joinButton.addEventListener("click", (e) => {
      e.preventDefault();
      clearInterval(countdownInterval);
      handleTournamentStart();
    });
  }

  if (elements.cancelButton) {
    elements.cancelButton.addEventListener("click", (e) => {
      e.preventDefault();
      clearInterval(countdownInterval);
      window.location.href = "dashboard.html";
    });
  }

  if (elements.backToDashboardBtn) {
    elements.backToDashboardBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "dashboard.html";
    });
  }

  // ───────────────────────────────────────────────────────────
  // 5) TOURNAMENT FUNCTIONS
  // ───────────────────────────────────────────────────────────
  async function handleTournamentStart() {
    // Check if user is logged in
    const user = auth.currentUser;
    if (!user) {
      showMessage("Please log in to join the tournament", "red");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
      return;
    }

    try {
      // Show loading state
      showLoading(true);
      
      // Get user data
      const userDoc = await dbFirestore.collection("users").doc(user.uid).get();
      
      if (!userDoc.exists) {
        showMessage("User profile not found", "red");
        showLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      
      // Register user for tournament
      const tournamentId = "tournament_" + new Date().toISOString().split("T")[0];
      
      await dbFirestore.collection("tournaments").doc(tournamentId).collection("participants").doc(user.uid).set({
        userId: user.uid,
        username: userData.username,
        fullName: userData.fullName,
        joinedAt: new Date().toISOString(),
        status: "active"
      });
      
      // Also save to realtime DB for faster queries
      await dbRealtime.ref(`tournaments/${tournamentId}/participants/${user.uid}`).set({
        userId: user.uid,
        username: userData.username,
        fullName: userData.fullName,
        joinedAt: new Date().toISOString(),
        status: "active"
      });
      
      showLoading(false);
      showMessage("Let's Take A Tour", "green");
      
      // Open YouTube playlist in a new tab
      window.open("https://www.youtube.com/playlist?list=PLk4_nsOUDG273ux1NuupxwnYUoxfWAq2_", "_blank");
      
      // Show preview container and hide tournament container
      if (elements.tournamentContainer) {
        elements.tournamentContainer.style.display = "none";
      }
      
      if (elements.previewContainer) {
        elements.previewContainer.style.display = "block";
      }
      
    } catch (err) {
      console.error("Tournament join error:", err);
      showLoading(false);
      showMessage(`Failed to join tournament: ${err.message}`, "red");
    }
  }

  // ───────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ───────────────────────────────────────────────────────────
  
  // Show/hide loader
  function showLoading(show) {
    if (elements.loader) {
      elements.loader.style.display = show ? 'flex' : 'none';
    }
  }
  
  // Show confirmation/alert messages
  function showMessage(message, color) {
    // Create message element if it doesn't exist
    let messageEl = document.getElementById("confirmationMessage");
    
    if (!messageEl) {
      messageEl = document.createElement("div");
      messageEl.id = "confirmationMessage";
      messageEl.classList.add("confirmation-message");
      document.body.appendChild(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.style.color = color;
    messageEl.style.backgroundColor =
      color === "green" ? "rgba(40,167,69,0.2)" :
      color === "red"   ? "rgba(220,53,69,0.2)" :
      color === "blue"  ? "rgba(13,110,253,0.2)" :
      "rgba(255,193,7,0.2)";
    messageEl.classList.remove("hidden");
    
    // Auto-hide non-error messages after 5 seconds
    if (color !== "red") {
      setTimeout(() => {
        messageEl.classList.add("hidden");
      }, 5000);
    }
  }
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});