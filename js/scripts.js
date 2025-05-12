document.addEventListener("DOMContentLoaded", () => {
  // ───────────────────────────────────────────────────────────
  // DOM Elements - Define all DOM elements at the start
  // ───────────────────────────────────────────────────────────
  const elements = {
    // Loader elements
    loader: document.querySelector(".loader-overlay"),
    
    // Auth form elements
    registerForm: document.getElementById("registerForm"),
    registerName: document.getElementById("registerName"),
    registerEmail: document.getElementById("registerEmail"),
    registerPassword: document.getElementById("registerPassword"),
    registerUsername: document.getElementById("registerUsername"), // Added: Was used but not defined
    
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginUsername: document.getElementById("loginUsername"), // Added: Was used but not defined
    
    // Leaderboard elements
    leaderboardContainer: document.getElementById("leaderboardData"),
    
    // Task submission elements
    submitForm: document.getElementById("submitTaskForm"),
    confirmEl: document.getElementById("confirmationMessage"),
    taskCategory: document.getElementById("taskCategory"),
    practiceContainer: document.getElementById("practiceContainer"),
    practiceList: document.getElementById("practiceList"),
    golferName: document.getElementById("golferName"),
    selectedList: document.getElementById("selectedList"),
    selectedLabel: document.getElementById("selectedLabel"),
    submitButton: document.getElementById("submitButton"),
    loader: document.getElementById("loader") // Added for use in showLoading function
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
  // 3) REGISTRATION FLOW
  // ───────────────────────────────────────────────────────────
  if (elements.registerForm) {
    elements.registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Show loading state
      showLoading(true);
      
      // Get and validate form values
      const name = elements.registerName?.value?.trim() || "";
      const username = elements.registerUsername?.value?.trim() || "";
      const email = elements.registerEmail?.value?.trim() || "";
      const password = elements.registerPassword?.value || "";
      
      // Basic validation
      if (!name || !username || !email || !password) {
        showLoading(false);
        return showMessage("Please fill in all fields.", "red");
      }
      
      if (password.length < 6) {
        showLoading(false);
        return showMessage("Password must be at least 6 characters.", "red");
      }
      
      // Username validation - check for alphanumeric and underscore only
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        showLoading(false);
        return showMessage("Username can only contain letters, numbers, and underscores.", "red");
      }
      
      try {
        // Check if username is already taken
        const usernameQuery = await dbFirestore.collection("usernames").doc(username).get();
        
        if (usernameQuery.exists) {
          showLoading(false);
          return showMessage("Username is already taken. Please choose another.", "red");
        }
        
        // Create the user account with email/password (Firebase Auth)
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const uid = user.uid;
        const createdAt = new Date().toISOString();
        
        const userData = {
          fullName: name,
          username: username,
          email: email,
          createdAt: createdAt,
          uid: uid
        };
        
        // Batch Firestore operations
        const batch = dbFirestore.batch();
        
        // Store user data
        const userDocRef = dbFirestore.collection("users").doc(uid);
        batch.set(userDocRef, userData);
        
        // Create username mapping document
        const usernameDocRef = dbFirestore.collection("usernames").doc(username);
        batch.set(usernameDocRef, {
          uid: uid,
          email: email,
          createdAt: createdAt
        });
        
        // Save data to Firestore and Realtime DB
        await batch.commit();
        await dbRealtime.ref("users/" + uid).set(userData);
        
        // Also create a mapping in realtime DB for faster username lookups
        await dbRealtime.ref("usernames/" + username).set({
          uid: uid,
          email: email
        });
        
        showLoading(false);
        showMessage("Registration successful! Redirecting to login...", "green");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      } catch (err) {
        console.error("Registration error:", err);
        showLoading(false);
        showMessage(`Registration failed: ${err.message}`, "red");
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // 4) LOGIN FLOW
  // ───────────────────────────────────────────────────────────
  if (elements.loginForm) {
    elements.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Show loading state
      showLoading(true);
      
      // Get and validate form values
      const username = elements.loginUsername?.value?.trim() || "";
      const password = elements.loginPassword?.value || "";
      
      // Basic validation
      if (!username || !password) {
        showLoading(false);
        return showMessage("Please enter both username and password.", "red");
      }
      
      try {
        // First, look up the email associated with this username
        let userEmail = null;
        
        // Try Realtime DB first (faster)
        const usernameSnapshot = await dbRealtime.ref(`usernames/${username}`).once("value");
        
        if (usernameSnapshot.exists()) {
          userEmail = usernameSnapshot.val().email;
        } else {
          // Fallback to Firestore
          const usernameDoc = await dbFirestore.collection("usernames").doc(username).get();
          
          if (usernameDoc.exists) {
            userEmail = usernameDoc.data().email;
          } else {
            showLoading(false);
            return showMessage("Username not found. Please check your username or register.", "red");
          }
        }
        
        // Now use Firebase Auth with the email
        await auth.signInWithEmailAndPassword(userEmail, password);
        
        showLoading(false);
        showMessage("Login successful! Redirecting to dashboard...", "green");
        
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1000);
      } catch (err) {
        console.error("Login error:", err);
        showLoading(false);
        
        if (err.code === "auth/wrong-password") {
          showMessage("Incorrect password. Please try again.", "red");
        } else if (err.code === "auth/user-not-found") {
          showMessage("Account not found. Please check your credentials.", "red");
        } else {
          showMessage(`Login failed: ${err.message}`, "red");
        }
      }
    });
  }

  // Helper function to show/hide loader
  function showLoading(show) {
    if (elements.loader) {
      elements.loader.style.display = show ? 'flex' : 'none';
    }
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
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});

// Animate on load
  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-loaded');
  });

  // Animate on page leave (before redirect or unload)
  const addExitAnimation = () => {
    document.body.classList.remove('page-loaded');
    document.body.classList.add('page-exit');
  };

  // Hook into link clicks (for page redirect transitions)
  document.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (!href.startsWith('#') && !href.startsWith('javascript:')) {
        e.preventDefault();
        addExitAnimation();
        setTimeout(() => {
          window.location.href = href;
        }, 500); // Match this to your exit animation time
      }
    });
  });

  // Hook into browser unload (optional)
  window.addEventListener('beforeunload', addExitAnimation);

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