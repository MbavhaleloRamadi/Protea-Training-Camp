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
  // SPECIAL POINTS DATE RANGES & TOURNAMENT DAYS
  // ───────────────────────────────────────────────────────────
  
  // Helper function to check if a date is within a range
  function isDateInRange(date, startDate, endDate) {
    return date >= startDate && date <= endDate;
  }
  
  // Helper function to create Date objects with consistent timezone handling
  function createDate(year, month, day) {
    // Month is 0-indexed in JavaScript Date (0 = January, 11 = December)
    return new Date(year, month - 1, day);
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

  // ───────────────────────────────────────────────────────────
  // PRACTICE SELECTION & SUBMISSION - UPDATED CODE WITH SPECIAL POINTS
  // ───────────────────────────────────────────────────────────

  const dbFirestore = firebase.firestore();
  const dbRealtime  = firebase.database();

  // DOM Elements
  const submitForm       = document.getElementById("submitTaskForm");
  const confirmEl        = document.getElementById("confirmationMessage");
  const taskCategory     = document.getElementById("taskCategory");
  const practiceContainer = document.getElementById("practiceContainer");
  const practiceList     = document.getElementById("practiceList");
  const submitButton     = document.getElementById("submitButton");
  const selectedList     = document.getElementById("selectedList");
  const selectedLabel    = document.getElementById("selectedLabel");
  
  // Add special points info element
  const specialPointsInfo = document.createElement("div");
  specialPointsInfo.id = "specialPointsInfo";
  specialPointsInfo.className = "special-points-info";
  specialPointsInfo.style.margin = "10px 0";
  specialPointsInfo.style.padding = "10px";
  specialPointsInfo.style.borderRadius = "5px";
  if (practiceContainer && practiceContainer.parentNode) {
    practiceContainer.parentNode.insertBefore(specialPointsInfo, practiceContainer);
  }

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
      { name: "OTC-Partime",         description: "Score a Par on a Hole (unlimitted per day)",                             points: 1, allowMultiple: true },
      { name: "OTC-Par3",            description: "Score a par or lower on a par 3 (unlimitted per day)",                   points: 1, allowMultiple: true },
      { name: "OTC-Up&Down",         description: "Score an Up&Down for par or lower out of a greenside bunker (unlimitted per day)", points: 1, allowMultiple: true },
      { name: "OTC-Full18",          description: "Play 18 holes on an official Golf Course",                               points: 2 },
      { name: "OTC-Birdies",         description: "Score a Birdie on a Hole (unlimitted per day)",                           points: 2, allowMultiple: true },
      { name: "OTC-Fairways4days",   description: "Hit 75% Fairways in regulation",                                          points: 2 },
      { name: "OTC-Deadaim",         description: "Hit 50% Greens in regulation",                                            points: 2 },
      { name: "OTC-MrPutt",          description: "Score average of 2 putts or less per hole",                               points: 2 },
      { name: "OTC-Beatme",          description: "Score below your course handicap",                                        points: 3 },
      { name: "OTC-Eagle",           description: "Score an Eagle (unlimitted per day)",                                     points: 5, allowMultiple: true }
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

  // Selected Practices (max 3 for normal practices, but unlimited for specified practices)
  let selectedPractices = [];

  // Check tournament days on page load
  function checkTournamentDays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
    
    if (!areSubmissionsAllowed(today)) {
      // Disable the form during tournament days
      if (submitForm) {
        submitForm.innerHTML = `
          <div class="tournament-notification" style="background-color: #ffe0e0; padding: 20px; border-radius: 5px; text-align: center;">
            <h3>⛳ Tournament in Progress!</h3>
            <p>Task submissions are disabled from September 24-28, 2025 during the tournament.</p>
            <p>Good luck to all participants!</p>
          </div>
        `;
      }
    }
  }
  
  // Run the tournament check on page load
  checkTournamentDays();

  // ───────────────────────────────────────────────────────────
  // 1) When category changes, show the scrollable list and special points info
  // ───────────────────────────────────────────────────────────
  if (taskCategory) {
    taskCategory.addEventListener("change", () => {
      const cat = taskCategory.value;
      
      // Check if practiceList exists before manipulating it
      if (!practiceList) {
        console.error("Practice list element not found!");
        return;
      }
      
      practiceList.innerHTML = "";
    
      if (!practicesData[cat]) {
        practiceContainer.classList.add("hidden");
        specialPointsInfo.innerHTML = "";
        return;
      }
      practiceContainer.classList.remove("hidden");
      
      // Update special points info
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
      
      const isSpecialPointsDay = shouldDoublePoints(cat, today);
      
      if (isSpecialPointsDay) {
        specialPointsInfo.innerHTML = `
          <div style="background-color: #e6f7ff; padding: 10px; border-radius: 5px; border-left: 4px solid #1890ff;">
            <h4 style="margin-top: 0;">🎯 DOUBLE POINTS ACTIVE!</h4>
            <p>All ${cat} practices submitted today will receive DOUBLE POINTS!</p>
          </div>
        `;
        specialPointsInfo.style.display = "block";
      } else {
        specialPointsInfo.innerHTML = "";
        specialPointsInfo.style.display = "none";
      }
    
      practicesData[cat].forEach(practice => {
        const card = document.createElement("div");
        card.className = "practice-card";
        
        // Calculate points based on special date ranges
        const displayPoints = isSpecialPointsDay ? practice.points * 2 : practice.points;
        const pointsText = isSpecialPointsDay ? 
          `<small>Points: <span style="color: #1890ff; font-weight: bold;">${displayPoints} (2x Bonus!)</span></small>` :
          `<small>Points: ${displayPoints}</small>`;
          
        card.innerHTML = `
          <h4>${practice.name}</h4>
          <p>${practice.description}</p>
          ${pointsText}
          ${practice.allowMultiple ? '<small style="color: #28a745; display: block; margin-top: 4px;">Can be added multiple times</small>' : ''}
        `;
        
        card.addEventListener("click", () => {
          // Check if practice is already selected and doesn't allow multiple entries
          if (!practice.allowMultiple && selectedPractices.find(p => p.name === practice.name)) {
            showConfirmation("Practice already selected.", "red");
            return;
          }
          
          // Check if we've reached the maximum of 3 non-multiple practices
          const nonMultipleCount = selectedPractices.filter(p => !p.allowMultiple).length;
          if (!practice.allowMultiple && nonMultipleCount >= 3) {
            showConfirmation("You can only select 3 regular practices.", "red");
            return;
          }
          
          // Add practice with potentially double points
          const practiceToAdd = {
            ...practice,
            originalPoints: practice.points,
            points: isSpecialPointsDay ? practice.points * 2 : practice.points,
            isDoublePoints: isSpecialPointsDay
          };
          
          // For multiple allowed practices, add a unique identifier
          if (practice.allowMultiple) {
            // Count how many of this practice are already selected
            const count = selectedPractices.filter(p => p.name === practice.name).length;
            practiceToAdd.uniqueId = `${practice.name}_${count + 1}`;
          }
          
          selectedPractices.push(practiceToAdd);
          renderSelected();
          showConfirmation(`✅ Added "${practice.name}"${practice.allowMultiple ? ` (${selectedPractices.filter(p => p.name === practice.name).length})` : ''}`, "green");
        });
        practiceList.appendChild(card);
      });
    });
  } else {
    console.error("Task category element not found!");
  }

  // ───────────────────────────────────────────────────────────
  // 2) Render the "Selected Practices" list
  // ───────────────────────────────────────────────────────────
  function renderSelected() {
    if (!selectedList) {
      console.error("Selected list element not found!");
      return;
    }
    
    selectedList.innerHTML = "";
    selectedPractices.forEach((p, i) => {
      const li = document.createElement("li");
      
      // Show double points indicator if applicable
      const pointsText = p.isDoublePoints ? 
        `${p.points} pts (2x Bonus!)` : 
        `${p.points} pts`;
      
      // For multiple allowed practices, show the count
      let displayName = p.name;
      if (p.allowMultiple) {
        // Find how many of this type exist
        const practiceCount = selectedPractices.filter(sp => sp.name === p.name).length;
        const thisIndex = selectedPractices.filter(sp => sp.name === p.name).indexOf(p) + 1;
        displayName = `${p.name} #${thisIndex}`;
      }
      
      li.innerHTML = `${displayName} <span style="${p.isDoublePoints ? 'color: #1890ff; font-weight: bold;' : ''}">(${pointsText})</span>`;
      li.style.cursor = "pointer";
      li.title = "Click to remove";
      li.addEventListener("click", () => {
        selectedPractices.splice(i, 1);
        renderSelected();
      });
      selectedList.appendChild(li);
    });
    
    // Count regular practices (non-multiple)
    const regularPracticesCount = selectedPractices.filter(p => !p.allowMultiple).length;
    const multiplePracticesCount = selectedPractices.filter(p => p.allowMultiple).length;
    
    if (selectedLabel) {
      selectedLabel.textContent = `Selected Practices (${regularPracticesCount}/3 regular, ${multiplePracticesCount} special)`;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 3) Submit handler - Updated to check tournament days
  // ───────────────────────────────────────────────────────────
  if (submitForm) {
    submitForm.addEventListener("submit", async e => {
      e.preventDefault();
      
      // Check if today is during tournament days
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
      
      if (!areSubmissionsAllowed(today)) {
        showConfirmation("⛔ Submissions are disabled during tournament days (Sept 24-28, 2025).", "red");
        return;
      }
      
      const user = firebase.auth().currentUser;
      if (!user) {
        showConfirmation("⚠️ You must be logged in to submit.", "red");
        return;
      }
    
      const nameElement = document.getElementById("golferName");
      if (!nameElement) {
        showConfirmation("⚠️ Golfer name field not found", "red");
        return;
      }
      
      const name = nameElement.value.trim();
      const category = taskCategory ? taskCategory.value : null;
      const date = today.toISOString().split("T")[0]; // YYYY-MM-DD
    
      if (!category || selectedPractices.length === 0) {
        showConfirmation("⚠️ Select a category and at least one practice.", "red");
        return;
      }
    
      const docId = `${user.uid}_${category}_${date}`.replace(/\s+/g, "_").toLowerCase();
      
      // Create references once
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
        if (submitButton) {
          submitButton.disabled = true;
        }
        
        showConfirmation("Submitting your task...", "blue");
    
        // Use the already defined userSubRef
        const batch = dbFirestore.batch();
        batch.set(userSubRef, payload);
    
        // Commit the batch and update Realtime DB
        await batch.commit();
        await dbRealtime.ref(`users/${user.uid}/task_submissions/${docId}`).set(payload);
    
        showConfirmation("✅ Task submitted successfully!", "green");
        selectedPractices = [];
        renderSelected();
        submitForm.reset();
        if (practiceContainer) {
          practiceContainer.classList.add("hidden");
        }
        if (specialPointsInfo) {
          specialPointsInfo.innerHTML = "";
          specialPointsInfo.style.display = "none";
        }
    
      } catch (err) {
        console.error("Submission error:", err);
        showConfirmation(`⚠️ Submission failed: ${err.message || "Unknown error"}`, "red");
      } finally {
        // Re-enable the submit button after a delay
        setTimeout(() => {
          if (submitButton) {
            submitButton.disabled = false;
          }
        }, 3000); // Re-enable after 3 seconds
      }
    });
  } else {
    console.error("Submit form element not found!");
  }

  // ───────────────────────────────────────────────────────────
  // Helper to show messages
  // ───────────────────────────────────────────────────────────
  function showConfirmation(msg, color) {
    if (!confirmEl) {
      console.error("Confirmation element not found!");
      console.log(msg); // At least log the message
      return;
    }
    
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