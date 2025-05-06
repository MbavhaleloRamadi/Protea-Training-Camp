document.addEventListener("DOMContentLoaded", () => {
  // ───────────────────────────────────────────────────────────
  // 1) PAGE LOADER
  // ───────────────────────────────────────────────────────────
  const loader = document.querySelector(".loader-overlay");
  if (loader) {
    window.addEventListener("load", () => {
      // fade out
      loader.style.transition = "opacity 0.6s ease";
      loader.style.opacity = "0";

      // then completely hide
      setTimeout(() => {
        loader.style.display = "none";
        document.body.style.visibility = "visible";
      }, 600);
    });
  }

  // ───────────────────────────────────────────────────────────
  // 2) FIREBASE INITIALIZATION
  // ───────────────────────────────────────────────────────────
  const firebaseConfig = {
    apiKey: "AIzaSyCLFOHGb5xaMSUtE_vgVO0aaY6MfLySeTs",
    authDomain: "protea-training-camp.firebaseapp.com",
    projectId: "protea-training-camp",
    storageBucket: "protea-training-camp.appspot.com",
    messagingSenderId: "649833361697",
    appId: "1:649833361697:web:5c402a67872ca10fe30e60",
    measurementId: "G-K1HKHPG6HG"
  };

  if (window.firebase) {
    firebase.initializeApp(firebaseConfig);
  } else {
    console.error("Firebase SDK not found.");
    return; // halt further setup
  }

  // Monitor auth‑state changes
  firebase.auth().onAuthStateChanged(user => {
    console.log(user ? "User is logged in" : "User is not logged in");
  });

  // ───────────────────────────────────────────────────────────
  // 3) REGISTRATION FLOW
  // ───────────────────────────────────────────────────────────
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", e => {
      e.preventDefault();

      const name     = document.getElementById("registerName").value.trim();
      const email    = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;

      firebase.auth()
        .createUserWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;
          const uid = user.uid;
          const createdAt = new Date().toISOString();

          const userData = {
            fullName: name,
            email: email,
            createdAt: createdAt,
            uid: uid
          };

          // Save to Firestore
          await firebase.firestore().collection("users").doc(uid).set(userData);

          // Save to Realtime Database
          await firebase.database().ref("users/" + uid).set(userData);

          alert("Registration successful!");
          window.location.href = "login.html";
        })
        .catch(err => {
          alert("Registration failed: " + err.message);
        });
    });
  }

  // ───────────────────────────────────────────────────────────
  // 4) LOGIN FLOW
  // ───────────────────────────────────────────────────────────
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();

      const email    = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      firebase.auth()
        .signInWithEmailAndPassword(email, password)
        .then(() => {
          window.location.href = "dashboard.html";
        })
        .catch(err => {
          if (err.code === "auth/wrong-password") {
            alert("Incorrect password. Please try again.");
          } else {
            alert("Login failed: Please register first.");
          }
        });
    });
  }

  // ───────────────────────────────────────────────────────────
  // 5) LEADERBOARD FETCH & RENDER
  // ───────────────────────────────────────────────────────────
  const leaderboardContainer = document.getElementById("leaderboardData");
  if (leaderboardContainer) {
    const db           = firebase.firestore();
    const leaderboard  = db
      .collection("leaderboard")
      .orderBy("score", "desc")
      .limit(10);

    leaderboard.get()
      .then(snapshot => {
        let rank = 1;
        snapshot.forEach(doc => {
          const { name, score } = doc.data();

          const row = document.createElement("div");
          row.classList.add("leaderboard-row");

          row.innerHTML = `
            <div class="rank">${rank++}</div>
            <div class="name">${name}</div>
            <div class="score">${score}</div>
          `;
          leaderboardContainer.appendChild(row);
        });
      })
      .catch(err => console.error("Leaderboard error:", err));
  }

  // ───────────────────────────────────────────────────────────
  // 6) PRACTICE SELECTION & SUBMISSION
  // ───────────────────────────────────────────────────────────

  const dbFirestore = firebase.firestore();
  const dbRealtime  = firebase.database();

  // DOM Elements
  const submitForm       = document.getElementById("submitTaskForm");
  const confirmEl        = document.getElementById("confirmationMessage");
  const taskCategory     = document.getElementById("taskCategory");
  const practiceContainer = document.getElementById("practiceContainer");
  const practiceName     = document.getElementById("practiceName");
  const addPracticeBtn   = document.getElementById("addPracticeBtn");
  const selectedList     = document.getElementById("selectedList");
  const selectedLabel    = document.getElementById("selectedLabel");

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
// 1) When category changes, show the scrollable list
// ───────────────────────────────────────────────────────────
taskCategory.addEventListener("change", () => {
  const cat = taskCategory.value;
  practiceList.innerHTML = "";

  if (!practicesData[cat]) {
    practiceContainer.classList.add("hidden");
    return;
  }
  practiceContainer.classList.remove("hidden");

  practicesData[cat].forEach(practice => {
    const card = document.createElement("div");
    card.className = "practice-card";
    card.innerHTML = `
      <h4>${practice.name}</h4>
      <p>${practice.description}</p>
      <small>Points: ${practice.points}</small>
    `;
    card.addEventListener("click", () => {
      if (selectedPractices.find(p => p.name === practice.name)) {
        showConfirmation("Practice already selected.", "red");
        return;
      }
      if (selectedPractices.length >= 3) {
        showConfirmation("You can only select 3 practices.", "red");
        return;
      }
      selectedPractices.push(practice);
      renderSelected();
      showConfirmation(`✅ Added "${practice.name}"`, "green");
    });
    practiceList.appendChild(card);
  });
});

// ───────────────────────────────────────────────────────────
// 2) Render the “Selected Practices” list
// ───────────────────────────────────────────────────────────
function renderSelected() {
  selectedList.innerHTML = "";
  selectedPractices.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.points} pts)`;
    li.style.cursor = "pointer";
    li.title = "Click to remove";
    li.addEventListener("click", () => {
      selectedPractices.splice(i, 1);
      renderSelected();
    });
    selectedList.appendChild(li);
  });
  selectedLabel.textContent = `Selected Practices (${selectedPractices.length}/3)`;
}

// ───────────────────────────────────────────────────────────
// 3) Submit handler
// ───────────────────────────────────────────────────────────
submitForm.addEventListener("submit", async e => {
  e.preventDefault();
  const user = firebase.auth().currentUser;
  if (!user) {
    showConfirmation("⚠️ You must be logged in to submit.", "red");
    return;
  }

  const name = document.getElementById("golferName").value.trim();
  const category = taskCategory.value;
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  if (!category || selectedPractices.length === 0) {
    showConfirmation("⚠️ Select a category and at least one practice.", "red");
    return;
  }

  const docId = `${user.uid}_${category}_${date}`.replace(/\s+/g, "_").toLowerCase();
  const userSubRef = dbFirestore
    .collection("users")
    .doc(user.uid)
    .collection("task_submissions")
    .doc(docId);

  try {
    const snap = await userSubRef.get();
    if (snap.exists) {
      showConfirmation("⛔ You already submitted this category today!", "red");
      return;
    }

    const payload = {
      golferName: name,
      category,
      date,
      practices: selectedPractices,
      timestamp: Date.now()
    };

    // Disable the submit button to prevent multiple submissions
    submitButton.disabled = true;
    showConfirmation("Submitting your task...", "blue");

    // Batch Firestore and Realtime DB updates
    const batch = dbFirestore.batch();
    const userSubRef = dbFirestore.collection("users").doc(user.uid).collection("task_submissions").doc(docId);
    
    // Batch Firestore update
    batch.set(userSubRef, payload);

    // Commit the batch and update Realtime DB
    await batch.commit();
    await dbRealtime.ref(`users/${user.uid}/task_submissions/${docId}`).set(payload);

    showConfirmation("✅ Task submitted successfully!", "green");
    selectedPractices = [];
    renderSelected();
    submitForm.reset();
    practiceContainer.classList.add("hidden");

  } catch (err) {
    console.error(err);
    showConfirmation("⚠️ Submission failed. Try again.", "red");
  } finally {
    // Re-enable the submit button after a delay
    setTimeout(() => {
      submitButton.disabled = false;
      }, 3000); // Re-enable after 3 seconds
    }
  });

// ───────────────────────────────────────────────────────────
// Helper to show messages
// ───────────────────────────────────────────────────────────
function showConfirmation(msg, color) {
  confirmEl.textContent = msg;
  confirmEl.style.color = color;
  confirmEl.style.backgroundColor =
    color === "green" ? "rgba(40,167,69,0.2)" :
    color === "red"   ? "rgba(220,53,69,0.2)" :
    color === "blue"  ? "rgba(13,110,253,0.2)" :
    "rgba(255,193,7,0.2)";
  confirmEl.classList.remove("hidden");
}
});


// Button click handlers
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


  