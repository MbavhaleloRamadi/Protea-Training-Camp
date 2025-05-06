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
    
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    
    // Leaderboard elements
    leaderboardContainer: document.getElementById("leaderboardData"),
    
    // Task submission elements
    submitForm: document.getElementById("submitTaskForm"),
    confirmEl: document.getElementById("confirmationMessage"),
    taskCategory: document.getElementById("taskCategory"),
    practiceContainer: document.getElementById("practiceContainer"),
    practiceList: document.getElementById("practiceList"), // Fixed: Was undefined
    golferName: document.getElementById("golferName"),
    selectedList: document.getElementById("selectedList"),
    selectedLabel: document.getElementById("selectedLabel"),
    submitButton: document.getElementById("submitButton") // Added: Was used but not defined
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

      // Get and validate form values
      const name = elements.registerName?.value?.trim() || "";
      const email = elements.registerEmail?.value?.trim() || "";
      const password = elements.registerPassword?.value || "";

      // Basic validation
      if (!name || !email || !password) {
        return showMessage("Please fill in all fields.", "red");
      }

      if (password.length < 6) {
        return showMessage("Password must be at least 6 characters.", "red");
      }

      try {
        // Create the user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const uid = user.uid;
        const createdAt = new Date().toISOString();

        const userData = {
          fullName: name,
          email: email,
          createdAt: createdAt,
          uid: uid
        };

        // Batch Firestore operations
        const batch = dbFirestore.batch();
        const userDocRef = dbFirestore.collection("users").doc(uid);
        batch.set(userDocRef, userData);
        
        // Save data and redirect
        await batch.commit();
        await dbRealtime.ref("users/" + uid).set(userData);

        showMessage("Registration successful! Redirecting to login...", "green");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      } catch (err) {
        console.error("Registration error:", err);
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

      // Get and validate form values
      const email = elements.loginEmail?.value?.trim() || "";
      const password = elements.loginPassword?.value || "";

      // Basic validation
      if (!email || !password) {
        return showMessage("Please enter both email and password.", "red");
      }

      try {
        await auth.signInWithEmailAndPassword(email, password);
        showMessage("Login successful! Redirecting to dashboard...", "green");
        
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1000);
      } catch (err) {
        console.error("Login error:", err);
        
        if (err.code === "auth/wrong-password") {
          showMessage("Incorrect password. Please try again.", "red");
        } else if (err.code === "auth/user-not-found") {
          showMessage("Email not registered. Please sign up first.", "red");
        } else {
          showMessage(`Login failed: ${err.message}`, "red");
        }
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // 5) LEADERBOARD FETCH & RENDER
  // ───────────────────────────────────────────────────────────
  if (elements.leaderboardContainer) {
    try {
      // Create a document fragment to improve performance
      const fragment = document.createDocumentFragment();
      const loadingMessage = document.createElement("div");
      loadingMessage.textContent = "Loading leaderboard...";
      elements.leaderboardContainer.appendChild(loadingMessage);

      dbFirestore
        .collection("leaderboard")
        .orderBy("score", "desc")
        .limit(10)
        .get()
        .then(snapshot => {
          let rank = 1;
          
          // Remove loading message
          elements.leaderboardContainer.innerHTML = "";
          
          if (snapshot.empty) {
            const emptyMessage = document.createElement("div");
            emptyMessage.textContent = "No leaderboard data available yet.";
            elements.leaderboardContainer.appendChild(emptyMessage);
            return;
          }
          
          snapshot.forEach(doc => {
            const { name, score } = doc.data();

            const row = document.createElement("div");
            row.classList.add("leaderboard-row");

            row.innerHTML = `
              <div class="rank">${rank++}</div>
              <div class="name">${name ? escapeHtml(name) : "Anonymous"}</div>
              <div class="score">${score || 0}</div>
            `;
            fragment.appendChild(row);
          });
          
          // Single DOM update with all rows
          elements.leaderboardContainer.appendChild(fragment);
        })
        .catch(err => {
          console.error("Leaderboard error:", err);
          elements.leaderboardContainer.innerHTML = "Error loading leaderboard. Please try again later.";
        });
    } catch (err) {
      console.error("Leaderboard setup error:", err);
    }
  }

  // ───────────────────────────────────────────────────────────
  // 6) PRACTICE SELECTION & SUBMISSION
  // ───────────────────────────────────────────────────────────

  // Practice Options
  const practicesData = {
    "Putting": [
      { name: "Putt-50/1",      description: "Putt 50 Balls longer than 1 Metre",                                                      points: 1 },
      { name: "Putt-50/2",      description: "Putt 50 Balls longer than 2 Metres",                                                     points: 1 },
      { name: "Putt-50/3",      description: "Putt 50 Balls longer than 3 Metres",                                                     points: 1 },
      { name: "Putt-Drain20/1", description: "Drain 20 Consecutive Putts Longer than 1 Metre",                                         points: 1 },
      { name: "Putt-Drain20/2", description: "Drain 20 Consecutive Putts Longer than 2 Metres",                                        points: 2 },
      { name: "Putt-Under36",   description: "Practice under 36 putts (2 putt average) for 18 different holes longer than 3 metres", points: 3 },
      { name: "Putt-CircleGame",description: "4 Balls in a circle around hole longer than 2 metres, drain consecutive 5 rounds",     points: 3 },
      { name: "Putt-ClockGame", description: "Finish the clock game - 12 Putts in circle from 0.5m + 1m + 1.5m (All 3 Distances)", points: 3 },
      { name: "Putt-MatchPlay", description: "Win against another player Matchplay 18 Holes on Practice Green",                    points: 5 },
      { name: "Putt-Distance",  description: "Set up a landing zone (10cm deep) at least 10 metres away, putt 10 consecutive putts in the landing zone", points: 5 }
    ],
    "Chipping": [
      { name: "Chip-50/3",       description: "Chip 50 Balls between 2-5 Metres (to satisfaction)",                         points: 1 },
      { name: "Chip-50/6",       description: "Chip 50 Balls between 5-10 Metres (to satisfaction)",                        points: 1 },
      { name: "Chip-L50",        description: "Hit 50 clean strikes with the Lobwedge between 10 - 20 Metres",             points: 2 },
      { name: "Chip-S50",        description: "Hit 50 clean strikes with the Sandwedge between 10 - 20 Metres",             points: 2 },
      { name: "Chip-P50",        description: "Hit 50 clean strikes with the Pitching Wedge between 10-20 Metres",          points: 2 },
      { name: "Chip-Bump& Run",  description: "Bump & Run 50 balls (Flight 1-2 Metres) (Run 3-5Metres)",                   points: 2 },
      { name: "Chip-Bunker",     description: "Hit 50 clean greenside bunker shots (to satisfaction)",                     points: 3 },
      { name: "Chip-Drain10/6",  description: "Drain 10 Consecutive Chip Shots into a bucket longer than 6 Metres",        points: 3 },
      { name: "Flop50",          description: "Flop 50 clean strikes with a flight above 2metres and within 5 Metres",     points: 3 },
      { name: "FlagHIT",         description: "Hit the flag 5 consecutive times outside 3 metres with any wedge club",      points: 5 },
      { name: "Chip-MatchPlay",  description: "Win against another player Matchplay 36 Holes on Chip Shots",               points: 5 }
    ],
    "Irons & Tee Shot": [
      { name: "Irons-9i/50",       description: "Hit 50 clean strikes with the 9i over 100m (to satisfaction)",               points: 1 },
      { name: "Irons-8i/50",       description: "Hit 50 clean strikes with the 8i over 100m (to satisfaction)",               points: 1 },
      { name: "Irons-5w/50",       description: "Hit 50 clean strikes with the 5wood over 150m (to satisfaction)",            points: 1 },
      { name: "Fairway-3w/50",     description: "Hit 50 clean strikes with the 3wood over 150m (to satisfaction)",            points: 1 },
      { name: "Driver-50",         description: "Hit 50 clean strikes with the Driver over 150m (to satisfaction)",            points: 1 },
      { name: "Bucket",            description: "Hit a full bucket (minimum 50 balls) on a driving range 9i-5i (only)",         points: 1 },
      { name: "Irons-7i/50",       description: "Hit 50 clean strikes with the 7i over 120m (to satisfaction)",               points: 2 },
      { name: "Irons-6i/50",       description: "Hit 50 clean strikes with the 6i over 120m (to satisfaction)",               points: 2 },
      { name: "Irons-5i/50",       description: "Hit 50 clean strikes with the 5i over 120m (to satisfaction)",               points: 2 },
      { name: "Irons-Approach",    description: "Hit 20 consecutive Targets between 120m - 160m (to satisfaction)",           points: 3 },
      { name: "9i-in9",            description: "Play 9 Holes on a course with Irons & Putter only",                          points: 5 },
      { name: "Fairway-Bunker",    description: "Hit 50 clean strikes out of a fairway bunker over 120 metres",               points: 5 }
    ],
    "Mental": [
      { name: "Mind-Chess",        description: "Play a game of chess",                                                       points: 1 },
      { name: "Mind-Juggle",       description: "Learn to Juggle for 60mins",                                                 points: 1 },
      { name: "Mind-Affirmation",  description: "Write down 10 different reasons why you want to win the Guarra Guarra 2025",  points: 1 },
      { name: "Mind Calmness",     description: "Medidate for 30mins",                                                         points: 1 },
      { name: "Mind Soduko",       description: "Complete a game of Sudoko",                                                   points: 1 },
      { name: "Mind Reflect",      description: "Compile a list of 5 different weaknesses in your game and how to improve each one", points: 1 },
      { name: "Mind Achive",       description: "Complete 5 improvements to weaknesses previously listed (to satisfaction)",   points: 2 },
      { name: "Mind Putt Routine", description: "Set up a Pre Shot Putting Routine (Practice the preshot PUTTING routine 50 times)", points: 2 },
      { name: "Mind Shot Routine", description: "Set up a Pre Shot Routine (Practice the preshot routine 50 times)",           points: 2 },
      { name: "Mind Control",      description: "Excersixe full deep breathing excersises for 30mins",                        points: 3 },
      { name: "Mind Learn",        description: "Complete any Book or Audio Book by Dr Bob Rotella (minimum 100minutes)",       points: 5 }
    ],
    "On The Course": [
      { name: "OTC-Quick9",          description: "Play 9 holes on an official Golf Course",                                 points: 1 },
      { name: "OTC-Myball",          description: "Finish with the Ball you started",                                       points: 1 },
      { name: "OTC-Partime",         description: "Score a Par on a Hole (unlimitted per day)",                             points: 1 },
      { name: "OTC-Par3",            description: "Score a par or lower on a par 3 (unlimitted per day)",                   points: 1 },
      { name: "OTC-Up&Down",         description: "Score an Up&Down for par or lower out of a greenside bunker (unlimitted per day)", points: 1 },
      { name: "OTC-Full18",          description: "Play 18 holes on an official Golf Course",                               points: 2 },
      { name: "OTC-Birdies",         description: "Score a Birdie on a Hole (unlimitted per day)",                           points: 2 },
      { name: "OTC-Fairways4days",   description: "Hit 75% Fairways in regulation",                                          points: 2 },
      { name: "OTC-Deadaim",         description: "Hit 50% Greens in regulation",                                            points: 2 },
      { name: "OTC-MrPutt",          description: "Score average of 2 putts or less per hole",                               points: 2 },
      { name: "OTC-Beatme",          description: "Score below your course handicap",                                        points: 3 },
      { name: "OTC-Eagle",           description: "Score an Eagle (unlimitted per day)",                                     points: 5 }
    ],
    "Tournament Prep": [
      { name: "TP-Visualize",    description: "Map out a hole of Magalies park golf course, Distances, Obstacles, Stroke, Par, Gameplan", points: 1 },
      { name: "TP-Recon",        description: "Create a player card of an opposing player with strengths, weaknesses, hcp performance etc.", points: 1 },
      { name: "TP-Teamwork",     description: "Play a full game under any of the Tournament formats (Matchplay, Betterball, Scramble Drive, Foursomes)", points: 2 },
      { name: "TP-Social",       description: "Attend any of the Training Camp Socials (Quiz Night, Iron Play, Driving Range Games etc.)", points: 2 },
      { name: "TP-Gametime",     description: "Play 18 Holes at Magaliespark Golf Course",                             points: 3 },
      { name: "TP-Highstakes",   description: "Play a highstakes 9 hole competition for minimum R100 against another player or team", points: 3 },
      { name: "TP-Puttoff",      description: "Play a highstakes 10Hole Putt off Matchplay competition for minimum R100 against another player", points: 3 }
    ],
    "Fitness": [
      { name: "Fit-50 Push Ups",       description: "Do 50 or more push ups",                points: 1 },
      { name: "Fit-50 Situps",         description: "Do 50 or more sit ups",                  points: 1 },
      { name: "Fit-Run2k",             description: "Run over 2km",                           points: 1 },
      { name: "Fit-Gym30",             description: "Do weight training for minimum 30mins", points: 1 },
      { name: "Fit-Stretch",           description: "Stretch or yoga for minimum 30mins",     points: 1 },
      { name: "Fit-Run5k",             description: "Run over 5km",                           points: 2 },
      { name: "Fit-Walk9",             description: "Walk for 9 holes game on an official golf course", points: 2 },
      { name: "Fit-Walk18",            description: "Walk for 18 holes game on an official golf course", points: 3 },
      { name: "Fit-Gettingbetter",     description: "Receive 5 Professional Golf Lessons",    points: 5 },
      { name: "Fit-Run10k",            description: "Run 10km or more",                       points: 5 }
    ]
  };

  // Selected Practices (max 3)
  let selectedPractices = [];

  // ───────────────────────────────────────────────────────────
  // Task category and practice selection 
  // ───────────────────────────────────────────────────────────
  if (elements.taskCategory && elements.practiceList) {
    elements.taskCategory.addEventListener("change", () => {
      const category = elements.taskCategory.value;
      renderPracticeOptions(category);
    });
  }

  function renderPracticeOptions(category) {
    if (!elements.practiceList) return;
    
    elements.practiceList.innerHTML = "";

    if (!practicesData[category]) {
      elements.practiceContainer.classList.add("hidden");
      return;
    }
    
    elements.practiceContainer.classList.remove("hidden");
    
    // Create a document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    practicesData[category].forEach(practice => {
      const card = createPracticeCard(practice);
      fragment.appendChild(card);
    });
    
    // Single DOM update
    elements.practiceList.appendChild(fragment);
  }

  function createPracticeCard(practice) {
    const card = document.createElement("div");
    card.className = "practice-card";
    card.innerHTML = `
      <h4>${escapeHtml(practice.name)}</h4>
      <p>${escapeHtml(practice.description)}</p>
      <small>Points: ${practice.points}</small>
    `;
    
    card.addEventListener("click", () => {
      handlePracticeSelection(practice);
    });
    
    return card;
  }

  function handlePracticeSelection(practice) {
    if (selectedPractices.find(p => p.name === practice.name)) {
      return showMessage("Practice already selected.", "red");
    }
    
    if (selectedPractices.length >= 3) {
      return showMessage("You can only select 3 practices.", "red");
    }
    
    selectedPractices.push(practice);
    renderSelected();
    showMessage(`✅ Added "${practice.name}"`, "green");
  }

  // ───────────────────────────────────────────────────────────
  // Render the "Selected Practices" list
  // ───────────────────────────────────────────────────────────
  function renderSelected() {
    if (!elements.selectedList) return;
    
    elements.selectedList.innerHTML = "";
    
    selectedPractices.forEach((practice, index) => {
      const li = document.createElement("li");
      li.textContent = `${practice.name} (${practice.points} pts)`;
      li.style.cursor = "pointer";
      li.title = "Click to remove";
      
      li.addEventListener("click", () => {
        selectedPractices.splice(index, 1);
        renderSelected();
        showMessage(`Removed "${practice.name}"`, "blue");
      });
      
      elements.selectedList.appendChild(li);
    });
    
    if (elements.selectedLabel) {
      elements.selectedLabel.textContent = `Selected Practices (${selectedPractices.length}/3)`;
    }
  }

  // ───────────────────────────────────────────────────────────
  // Submit task form
  // ───────────────────────────────────────────────────────────
  if (elements.submitForm) {
    elements.submitForm.addEventListener("submit", async e => {
      e.preventDefault();
      
      // Check if user is logged in
      const user = auth.currentUser;
      if (!user) {
        return showMessage("⚠️ You must be logged in to submit.", "red");
      }
      
      // Get form values
      const name = elements.golferName?.value?.trim() || "";
      const category = elements.taskCategory?.value || "";
      const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      
      // Validate form
      if (!name) {
        return showMessage("⚠️ Please enter your name.", "red");
      }
      
      if (!category) {
        return showMessage("⚠️ Please select a category.", "red");
      }
      
      if (selectedPractices.length === 0) {
        return showMessage("⚠️ Please select at least one practice.", "red");
      }
      
      // Create unique ID with timestamp to prevent collisions
      const timestamp = Date.now();
      const docId = `${user.uid}_${category}_${date}_${timestamp}`.replace(/\s+/g, "_").toLowerCase();
      
      try {
        // Disable submit button
        if (elements.submitButton) {
          elements.submitButton.disabled = true;
        }
        
        showMessage("Submitting your task...", "blue");
        
        const payload = {
          golferName: name,
          category,
          date,
          practices: selectedPractices,
          timestamp: timestamp,
          userId: user.uid
        };
        
        // Batch Firestore operations
        const batch = dbFirestore.batch();
        const userSubRef = dbFirestore
          .collection("users")
          .doc(user.uid)
          .collection("task_submissions")
          .doc(docId);
          
        batch.set(userSubRef, payload);
        
        // Commit batch and update Realtime DB
        await batch.commit();
        await dbRealtime.ref(`users/${user.uid}/task_submissions/${docId}`).set(payload);
        
        // Success - reset form
        showMessage("✅ Task submitted successfully!", "green");
        selectedPractices = [];
        renderSelected();
        elements.submitForm.reset();
        elements.practiceContainer.classList.add("hidden");
        
      } catch (err) {
        console.error("Task submission error:", err);
        showMessage("⚠️ Submission failed. Please try again.", "red");
      } finally {
        // Re-enable submit button after delay
        setTimeout(() => {
          if (elements.submitButton) {
            elements.submitButton.disabled = false;
          }
        }, 3000);
      }
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
  
  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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