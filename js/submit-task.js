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

  // User Authentication & Username Loading
// We'll put this in one place to avoid duplication
firebase.auth().onAuthStateChanged(user => {
  console.log(user ? "User is logged in" : "User is not logged in");
  
  if (!user) {
    const nameDisplay = document.getElementById("golferNameDisplay");
    if (nameDisplay) {
      nameDisplay.textContent = "Please log in";
    }
    return;
  }

  const userId = user.uid;
  const nameDisplay = document.getElementById("golferNameDisplay");
  const nameInput = document.getElementById("golferName");

  if (!nameDisplay || !nameInput) {
    console.error("Name display or input elements not found");
    return;
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Fetch today's completed practices from Firestore
  const dailyCompletionsRef = firebase.firestore()
      .collection("users").doc(userId)
      .collection("daily_completions").doc(today);

  dailyCompletionsRef.get().then(doc => {
    if (doc.exists) {
      // Store the array of completed practice names
      todaysCompletedPractices = doc.data().completed_practices || [];
      console.log("Fetched today's completed practices:", todaysCompletedPractices);
    } else {
      console.log("No practices submitted yet today.");
      todaysCompletedPractices = [];
    }
  }).catch(error => {
    console.error("Error fetching daily completions:", error);
  });

  // First try Firestore
  firebase.firestore().collection("users").doc(userId).get()
    .then(doc => {
      if (doc.exists && doc.data().username) {
        const username = doc.data().username;
        nameDisplay.textContent = username;
        nameInput.value = username;
        console.log("Username loaded from Firestore:", username);
      } else {
        console.log("Username not found in Firestore, trying Realtime DB");
        // Fallback to Realtime DB if Firestore doesn't have username
        return firebase.database().ref('users/' + userId).once('value');
      }
    })
    .then(snapshot => {
      if (snapshot && snapshot.exists()) {
        const data = snapshot.val();
        const username = data.username || "Unnamed Golfer";
        nameDisplay.textContent = username;
        nameInput.value = username;
        console.log("Username loaded from Realtime DB:", username);
      } else if (!nameInput.value) {
        nameDisplay.textContent = "Name not found";
        console.log("Username not found in either database");
      }
    })
    .catch(error => {
      console.error("Error fetching username:", error);
      nameDisplay.textContent = "Error loading name";
    });
});


  // ───────────────────────────────────────────────────────────
  // 3) SPECIAL POINTS DATE RANGES & TOURNAMENT DAYS
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
  // 4. PRACTICE SELECTION & SUBMISSION - UPDATED CODE WITH SPECIAL POINTS
  // ───────────────────────────────────────────────────────────

  const dbFirestore = firebase.firestore();
  const dbRealtime  = firebase.database();

  // DOM Elements
  const submitForm        = document.getElementById("submitTaskForm");
  const confirmEl         = document.getElementById("confirmationMessage");
  const taskCategory      = document.getElementById("taskCategory");
  const practiceContainer = document.getElementById("practiceContainer");
  const practiceList      = document.getElementById("practiceList");  
  const selectedList      = document.getElementById("selectedList");
  const selectedLabel     = document.getElementById("selectedLabel");
  const submitButton      = document.getElementById("submitBtn");

  let todaysCompletedPractices = []; // This will store practices completed today
  
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
    { name: "Putt-30/1",      description: "Putt 30 Balls longer than 1 Metres",                                                      points: 5 },
    { name: "Putt-30/2",      description: "Putt 30 Balls longer than 2 Metres",                                                     points: 5 },
    { name: "Putt-30/3",      description: "Putt 30 Balls longer than 3 Metres",                                                     points: 5 },
    { name: "Putt-Drain10/1", description: "Drain 10 Consecutive Putts Longer than 1 Metre",                                         points: 5 },
    { name: "Putt-Drain10/2", description: "Drain 10 Consecutive Putts Longer than 2 Metres",                                        points: 10 },
    { name: "Putt-Under36",   description: "Practise under 36 putts (2 putt average) for 18 different holes longer than 3 metres", points: 15 },
    { name: "Putt-CircleGame",description: "4 Balls in a circle around hole longer than 2 metres, drain consecutive 5 rounds",     points: 15 },
    { name: "Putt-ClockGame", description: "Finish the clock game - 12 Putts in circle from 0.5m + 1m + 1.5m (All 3 Distances)", points: 15 },
    { name: "Putt-MatchPlay", description: "Win against another player Matchplay 18 Holes on Practice Green",                    points: 25 },
    { name: "Putt-Distance",  description: "Set up a landing zone (10cm deep) at least 10 metres away, putt 10 consecutive putts in the landing zone", points: 25 },
    { name: "Putt-Drain20/5", description: "Drain 20 Consecutive Putts Longer than 5 Metres",                                    points: 25 }
  ],
  "Chipping": [
    { name: "Chip-30/3",       description: "Chip 30 Balls between 2-5 Metres (to satisfaction)",                         points: 5 },
    { name: "Chip-30/6",       description: "Chip 30 Balls between 5-10 Metres (to satisfaction)",                        points: 5 },
    { name: "Chip-L30",        description: "Hit 30 clean strikes with the Lobwedge between 10 - 20 Metres",             points: 10 },
    { name: "Chip-S30",        description: "Hit 30 clean strikes with the Sandwedge between 10 - 20 Metres",             points: 10 },
    { name: "Chip-P30",        description: "Hit 30 clean strikes with the Pitching Wedge between 10-20 Metres",          points: 10 },
    { name: "Chip-Bump& Run",  description: "Bump & Run 30 balls (Flight 1-2 Metres) (Run 3-5Metres)",                   points: 10 },
    { name: "Chip-Bunker",     description: "Hit 30 clean greenside bunker shots (to satisfaction)",                     points: 15 },
    { name: "Chip-Drain5/6",   description: "Drain 5 Consecutive Chip Shots into a bucket longer than 6 Metres",        points: 15 },
    { name: "Flop30",          description: "Flop 30 clean strikes with a flight above 2metres and within 5 Metres",     points: 15 },
    { name: "FlagHIT",         description: "Hit the flag 3 consecutive times outside 3 metres with any wedge club",      points: 25 },
    { name: "Chip-MatchPlay",  description: "Win against another player Matchplay 18 Holes on Chip Shots",               points: 25 }
  ],
  "Irons & Tee Shot": [
    { name: "Irons-9i/30",       description: "Hit 30 clean strikes with the 9i over 100m (to satisfaction)",               points: 5 },
    { name: "Irons-8i/30",       description: "Hit 30 clean strikes with the 8i over 100m (to satisfaction)",               points: 5 },
    { name: "Irons-5w/30",       description: "Hit 30 clean strikes with the 5wood over 150m (to satisfaction)",            points: 5 },
    { name: "Fairway-3w/30",     description: "Hit 30 clean strikes with the 3wood over 150m (to satisfaction)",            points: 5 },
    { name: "Driver-30",         description: "Hit 30 clean strikes with the Driver over 150m (to satisfaction)",            points: 5 },
    { name: "Bucket",            description: "Hit a full bucket (minimum 50 balls) on a driving range 9i-5i (only)",         points: 5 },
    { name: "Irons-7i/30",       description: "Hit 30 clean strikes with the 7i over 120m (to satisfaction)",               points: 10 },
    { name: "Irons-6i/30",       description: "Hit 30 clean strikes with the 6i over 120m (to satisfaction)",               points: 10 },
    { name: "Irons-5i/30",       description: "Hit 30 clean strikes with the 5i over 120m (to satisfaction)",               points: 10 },
    { name: "Irons-Approach",    description: "Hit 20 consecutive Targets between 120m - 160m (to satisfaction)",           points: 15 },
    { name: "9i-in9",            description: "Play 9 Holes on a course with Irons & Putter only",                          points: 25 },
    { name: "Fairway-Bunker",    description: "Hit 30 clean strikes out of a fairway bunker over 120 metres",               points: 25 }
  ],
  "Mental": [
    { name: "Mind-Chess",        description: "Play a game of chess",                                                       points: 3 },
    { name: "Mind-Juggle",       description: "Learn to Juggle for 60mins",                                                 points: 3 },
    { name: "Mind-Affirmation",  description: "Write down 10 different reasons why you want to win the Guarra Guarra 2025",  points: 3 },
    { name: "Mind Calmness",     description: "Medidate for 30mins",                                                         points: 3 },
    { name: "Mind Soduko",       description: "Complete a game of Sudoko",                                                   points: 3 },
    { name: "Mind Reflect",      description: "Compile a list of 5 different weaknesses in your game and how to improve each one", points: 3 },
    { name: "Mind Achive",       description: "Complete 5 improvements to weaknesses previously listed (to satisfaction)",   points: 5 },
    { name: "Mind Putt Routine", description: "Set up a Pre Shot Putting Routine (Practice the preshot PUTTING routine 30 times)", points: 5 },
    { name: "Mind Shot Routine", description: "Set up a Pre Shot Routine (Practice the preshot routine 30 times)",           points: 5 },
    { name: "Mind Control",      description: "Excersixe full deep breathing excersises for 30mins",                        points: 10 },
    { name: "Mind Learn",        description: "Complete any Book or Audio Book by Dr Bob Rotella (minimum 100minutes)",       points: 25 }
  ],
  "On The Course": [
    { name: "OTC-Quick9",          description: "Play 9 holes on an official Golf Course",                                 points: 5 },
    { name: "OTC-Myball",          description: "Finish with the Ball you started",                                       points: 5 },
    { name: "OTC-Partime",         description: "Score a Par on a Hole (unlimitted per day)",                             points: 5, allowMultiple: true },
    { name: "OTC-Par3",            description: "Score a par or lower on a par 3 (unlimitted per day)",                   points: 5, allowMultiple: true },
    { name: "OTC-Up&Down",         description: "Score an Up&Down for par or lower out of a greenside bunker (unlimitted per day)", points: 5, allowMultiple: true },
    { name: "OTC-Full18",          description: "Play 18 holes on an official Golf Course",                               points: 10 },
    { name: "OTC-Birdies",         description: "Score a Birdie on a Hole (unlimitted per day)",                          points: 10, allowMultiple: true },
    { name: "OTC-Fairways4days",   description: "Hit 75% Fairways in regulation",                                         points: 10 },
    { name: "OTC-Deadaim",         description: "Hit 50% Greens in regulation",                                           points: 10 },
    { name: "OTC-MrPutt",          description: "Score average of 2 putts or less per hole",                              points: 10 },
    { name: "OTC-Beatme",          description: "Score below your course handicap",                                       points: 15 },
    { name: "OTC-Eagle",           description: "Score an Eagle (unlimitted per day)",                                    points: 25, allowMultiple: true }
  ],
  "Tournament Prep": [
    { name: "TP-Visualize",    description: "Map out a hole of Magalies park golf course, Distances, Obstacles, Stroke, Par, Gameplan", points: 5 },
    { name: "TP-Recon",        description: "Create a player card of an opposing player with strengths, weaknesses, hcp performance etc.", points: 5 },
    { name: "TP-Teamwork",     description: "Play a full game under any of the Tournament formats (Matchplay, Betterball, Scramble Drive, Foursomes)", points: 10 },
    { name: "TP-Social",       description: "Attend any of the Training Camp Socials (Quiz Night, Iron Play, Driving Range Games etc.)", points: 10 },
    { name: "TP-Gametime",     description: "Play 18 Holes at Magaliespark Golf Course",                             points: 15 },
    { name: "TP-Highstakes",   description: "Play a highstakes 9 hole competition for minimum R100 against another player or team", points: 15 },
    { name: "TP-Puttoff",      description: "Play a highstakes 10Hole Putt off Matchplay competition for minimum R100 against another player", points: 15 }
  ],
  "Fitness": [
    { name: "Fit-50 Push Ups",       description: "Do 50 or more push ups",                points: 5 },
    { name: "Fit-50 Situps",         description: "Do 50 or more sit ups",                  points: 5 },
    { name: "Fit-Run2k",             description: "Run over 2km",                           points: 5 },
    { name: "Fit-Gym30",             description: "Do weight training for minimum 30mins", points: 5 },
    { name: "Fit-Stretch",           description: "Stretch or yoga for minimum 30mins",     points: 5 },
    { name: "Fit-Run5k",             description: "Run over 5km",                           points: 10 },
    { name: "Fit-Walk9",             description: "Walk for 9 holes game on an official golf course", points: 10 },
    { name: "Fit-Walk18",            description: "Walk for 18 holes game on an official golf course", points: 15 },
    { name: "Fit-Gettingbetter",     description: "Receive 5 Professional Golf Lessons",    points: 25 },
    { name: "Fit-Run10k",            description: "Run 10km or more",                       points: 25 }
  ]
};

// ───────────────────────────────────────────────────────────
// 5. PRACTICE SELECTION & SUBMISSION - FIXED CODE
// ───────────────────────────────────────────────────────────

// Initialize the selected practices array
let selectedPractices = [];

// Function to show confirmation messages to the user
function showConfirmation(message, type = "green") {
  const confirmationMessage = document.getElementById('confirmationMessage');
  if (!confirmationMessage) return;
  
  confirmationMessage.textContent = message;
  confirmationMessage.classList.remove('hidden');
  
  // Set color based on type
  if (type === "green") {
    confirmationMessage.style.backgroundColor = "rgba(40, 167, 69, 0.9)";
  } else if (type === "red") {
    confirmationMessage.style.backgroundColor = "rgba(220, 53, 69, 0.9)";
  } else if (type === "blue") {
    confirmationMessage.style.backgroundColor = "rgba(0, 123, 255, 0.9)";
  }
  
  // Show the message
  confirmationMessage.style.opacity = "1";
  confirmationMessage.style.transform = "translateY(0)";
  
  // Hide after 3 seconds
  setTimeout(() => {
    confirmationMessage.style.opacity = "0";
    confirmationMessage.style.transform = "translateY(10px)";
    
    // After the fade out animation completes, hide the element
    setTimeout(() => {
      confirmationMessage.classList.add('hidden');
    }, 200);
  }, 2000);
}

// Function to update the selected practices display
function updateSelectedPracticesDisplay() {
  const selectedList = document.getElementById('selectedList');
  const selectedLabel = document.getElementById('selectedLabel');
  const submitBtn = document.getElementById('submitBtn');
  
  if (!selectedList || !selectedLabel) {
    console.error("Required elements for selected practices display not found");
    return;
  }
  
  // Clear the current list
  selectedList.innerHTML = "";
  
  // Show/hide the "no practices" message
  if (selectedPractices.length === 0) {
    selectedLabel.textContent = "Selected Practices (None)";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('disabled');
    }
    return;
  } else {
    selectedLabel.textContent = `Selected Practices (${selectedPractices.length})`;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('disabled');
    }
  }
  
  // Calculate total points
  let totalPoints = 0;
  
  // Add each selected practice to the list
  selectedPractices.forEach((practice, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'selected-practice-item';
    
    // Calculate points for display
    const pointsToShow = practice.points;
    totalPoints += pointsToShow;
    
    // Create the HTML for the list item
    listItem.innerHTML = `
      <div class="practice-details">
        <span class="practice-name">${practice.name}</span>
        <span class="practice-category">Category: ${practice.category}</span>
      </div>
      <div class="practice-points-section">
        <span class="practice-points ${practice.isDoublePoints ? 'bonus-points' : ''}">
          ${pointsToShow} points ${practice.isDoublePoints ? '(2x)' : ''}
        </span>
        <button type="button" class="remove-practice-btn" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </div>
    `;
    
    selectedList.appendChild(listItem);
    
    // Add event listener to the remove button
    const removeButton = listItem.querySelector('.remove-practice-btn');
    if (removeButton) {
      removeButton.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent form submission
        const index = parseInt(this.getAttribute('data-index'));
        if (!isNaN(index) && index >= 0 && index < selectedPractices.length) {
          // Add fadeout class for animation
          listItem.classList.add('fadeout');
          
          // Wait for animation to complete
          setTimeout(() => {
            // Remove the practice from the array
            selectedPractices.splice(index, 1);
            // Update the display
            updateSelectedPracticesDisplay();
          }, 300); // Match this to your CSS animation duration
        }
      });
    }
  });
  
  // Display total points if there are practices selected
  if (selectedPractices.length > 0) {
    const totalItem = document.createElement('li');
    totalItem.className = 'total-points-item';
    totalItem.innerHTML = `
      <strong>Total Points: ${totalPoints}</strong>
    `;
    selectedList.appendChild(totalItem);
  }
}

// ───────────────────────────────────────────────────────────
// 6) When category changes, show the scrollable list and special points info - FIXED
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

       // If the practice does not allow multiple submissions AND it has already been completed today, skip it.
      if (!practice.allowMultiple && todaysCompletedPractices.includes(practice.name)) {
        return; // This will hide the practice from the list
      }

      const card = document.createElement("div");
      card.className = "practice-card";
      card.style.cssText = `
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 12px;
        transition: transform 0.2s, box-shadow 0.2s;
        background-color: #ffffff;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        border-left: 4px solid ${practice.allowMultiple ? '#28a745' : '#6c757d'};
        width: 100%;
        max-width: 600px;
        min-height: 140px; /* Increased height */
        background-image: radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0);
        background-size: 10px 10px;
      `;

      // Add hover effect
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        card.style.backgroundColor = '#f9f9f9'; // Slightly different background on hover
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        card.style.backgroundColor = '#ffffff'; // Restore original background
      });

      // Calculate points based on special date ranges
      const displayPoints = isSpecialPointsDay ? practice.points * 2 : practice.points;
      const pointsText = isSpecialPointsDay ? 
        `<div style="color: #1890ff; font-weight: bold; margin-top: 8px;">Points: ${displayPoints} (2x Bonus!)</div>` :
        `<div style="margin-top: 8px;">Points: <strong>${displayPoints}</strong></div>`;

      card.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%; text-align: left; height: 100%;">
          <h4 style="margin-top: 0; margin-bottom: 8px; font-size: 1rem; color: #222222;">${practice.name}</h4>
          <p style="margin: 0 0 10px; font-size: 0.9rem; color: #4a4a4a; line-height: 1.4;">${practice.description}</p>
          <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05);">
            ${pointsText}
            ${practice.allowMultiple ? 
              '<div style="color: #28a745; font-size: 0.85rem; font-weight: bold; display: flex; align-items: center;"><span style="margin-right: 4px;">⭐</span> Unlimited entries</div>' : ''}
          </div>
        </div>
      `;

      // FIXED: Single click event handler for practice card
      card.addEventListener("click", () => {
        // Check if practice is already selected and doesn't allow multiple entries
        if (!practice.allowMultiple && selectedPractices.find(p => p.name === practice.name)) {
          showConfirmation("Practice already selected.", "red");
          return;
        }
        
        // Add the practice to selected practices list with potentially double points
        const practiceToAdd = {
          name: practice.name,
          points: isSpecialPointsDay ? practice.points * 2 : practice.points,
          category: cat,
          isDoublePoints: isSpecialPointsDay,
          originalPoints: practice.points
        };
        
        // For multiple allowed practices, add a unique identifier
        if (practice.allowMultiple) {
          // Count how many of this practice are already selected
          const count = selectedPractices.filter(p => p.name === practice.name).length;
          practiceToAdd.uniqueId = `${practice.name}_${count + 1}`;
        }
        
        selectedPractices.push(practiceToAdd);
        
        // Create a visual confirmation and update selected practices display
        showConfirmation(`✅ Added "${practice.name}"${practice.allowMultiple ? 
          ` (${selectedPractices.filter(p => p.name === practice.name).length})` : ''}`, "green");
        updateSelectedPracticesDisplay();

        // Only scroll to selected practices if we have 1 or fewer items
if (selectedPractices.length <= 1) {
  const selectedLabel = document.getElementById('selectedLabel');
  if (selectedLabel) {
    selectedLabel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}
        
        // Provide visual feedback on the clicked card
        card.style.backgroundColor = '#f0f8ff'; // Light blue background
        setTimeout(() => {
          card.style.backgroundColor = '#ffffff'; // Reset back to original
        }, 300);
      });
      
      practiceList.appendChild(card);
    });
  });
}

// Call the function to add styles when the page loads
document.addEventListener('DOMContentLoaded', function() {
  addSelectedPracticesStyles();
  // Initialize the selected practices display
  updateSelectedPracticesDisplay();
});

// ───────────────────────────────────────────────────────────
// FIXED: Submit handler with totalUserScore update + Selected Practices Display
// ───────────────────────────────────────────────────────────

// Helper function to update totalUserScore based on points difference
async function updateTotalUserScore(userId, pointsDifference) {
  try {
    if (pointsDifference === 0) {
      console.log("No points difference, skipping totalUserScore update");
      return;
    }

    console.log(`Updating totalUserScore by ${pointsDifference} points for user ${userId}`);
    
    // Update Firestore using increment
    const userDocRef = dbFirestore.collection('users').doc(userId);
    await userDocRef.update({
      'practice_submissions.totalUserScore': firebase.firestore.FieldValue.increment(pointsDifference)
    });
    
    // Update Realtime Database
    const userScoreRef = dbRealtime.ref(`users/${userId}/practice_submissions/totalUserScore`);
    const currentScoreSnapshot = await userScoreRef.once('value');
    const currentScore = currentScoreSnapshot.val() || 0;
    const newScore = currentScore + pointsDifference;
    await userScoreRef.set(newScore);
    
    console.log(`Successfully updated totalUserScore: ${currentScore} + ${pointsDifference} = ${newScore}`);
  } catch (error) {
    console.error('Error updating totalUserScore:', error);
    throw error;
  }
}

// Helper function to get current daily submission points
async function getCurrentDailyPoints(userId, dailySubmissionId) {
  try {
    const metadataRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId);
    
    const metadataDoc = await metadataRef.get();
    
    if (metadataDoc.exists) {
      return metadataDoc.data().totalPoints || 0;
    }
    
    return 0; // New submission, no existing points
  } catch (error) {
    console.error("Error getting current daily points:", error);
    return 0;
  }
}

// FIXED: Helper function to calculate daily totals
async function calculateDailyTotals(userId, dailySubmissionId) {
  try {
    const categoriesRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId)
      .collection('categories');
    
    const categoriesSnapshot = await categoriesRef.get();
    
    let dailyTotalPoints = 0;
    let dailyTotalPractices = 0;
    let dailyTotalCategories = 0;
    
    categoriesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.isDeleted) {
        dailyTotalPoints += data.totalPoints || 0;
        dailyTotalPractices += data.totalPractices || 0;
        dailyTotalCategories += 1;
      }
    });
    
    return {
      dailyTotalPoints,
      dailyTotalPractices,
      dailyTotalCategories
    };
  } catch (error) {
    console.error("Error calculating daily totals:", error);
    return { dailyTotalPoints: 0, dailyTotalPractices: 0, dailyTotalCategories: 0 };
  }
}

// FIXED: Helper function to calculate user lifetime totals
async function calculateUserTotals(userId) {
  try {
    const submissionsRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions');
    
    const submissionsSnapshot = await submissionsRef.get();
    
    let totalPoints = 0;
    let totalPractices = 0;
    
    // Process each daily submission
    for (const submissionDoc of submissionsSnapshot.docs) {
      const submissionData = submissionDoc.data();
      
      // Check if this is a metadata document (has dailySubmissionId field)
      if (submissionData.dailySubmissionId && !submissionData.isDeleted) {
        totalPoints += submissionData.totalPoints || 0;
        totalPractices += submissionData.totalPractices || 0;
      }
    }
    
    return { totalPoints, totalPractices };
  } catch (error) {
    console.error("Error calculating user totals:", error);
    return { totalPoints: 0, totalPractices: 0 };
  }
}

// Helper function to generate or get daily submission ID
async function getDailySubmissionId(userId, date) {
  try {
    // Check if there's already a submission for this date
    const submissionsRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .where('date', '==', date)
      .limit(1);
    
    const existingSubmissions = await submissionsRef.get();
    
    if (!existingSubmissions.empty) {
      // Return existing daily submission ID
      const existingDoc = existingSubmissions.docs[0];
      return existingDoc.data().dailySubmissionId;
    }
    
    // Generate new daily submission ID
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9).toUpperCase();
    const dateFormatted = date.replace(/-/g, '');
    
    return `SUB_${dateFormatted}_${timestamp}_${randomSuffix}`;
    
  } catch (error) {
    console.error("Error getting/generating daily submission ID:", error);
    // Fallback ID generation
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9).toUpperCase();
    const dateFormatted = date.replace(/-/g, '');
    return `SUB_${dateFormatted}_${timestamp}_${randomSuffix}`;
  }
}

// Helper function to check if submissions are allowed (tournament days check)
function areSubmissionsAllowed(date) {
  try {
    // Add your tournament days logic here
    // For now, allow all submissions except specific tournament dates
    const tournamentDates = [
      // Add tournament dates that block submissions
      // '2025-06-15', '2025-06-16' // Example
    ];
    
    const dateString = date.toISOString().split('T')[0];
    return !tournamentDates.includes(dateString);
    
  } catch (error) {
    console.error("Error checking submission allowance:", error);
    return true; // Allow by default if check fails
  }
}

// Helper function to show confirmation messages
function showConfirmation(message, type = 'info') {
  try {
    // Create or get existing notification element
    let notification = document.getElementById('practice-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'practice-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      `;
      document.body.appendChild(notification);
    }
    
    // Set message and color based on type
    notification.textContent = message;
    
    switch(type) {
      case 'green':
      case 'success':
        notification.style.backgroundColor = '#28a745';
        break;
      case 'red':
      case 'error':
        notification.style.backgroundColor = '#dc3545';
        break;
      case 'yellow':
      case 'warning':
        notification.style.backgroundColor = '#ffc107';
        notification.style.color = '#212529';
        break;
      default:
        notification.style.backgroundColor = '#17a2b8';
    }
    
    // Show notification
    notification.style.display = 'block';
    notification.style.opacity = '1';
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      if (notification) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
    
  } catch (error) {
    console.error("Error showing confirmation:", error);
    // Fallback to alert
    alert(message);
  }
}

// FIXED: Helper function to update selected practices display
function updateSelectedPracticesDisplay() {
  try {
    // Use the actual selectedList element from the HTML
    const displayContainer = document.getElementById('selectedList');
    
    if (!displayContainer) {
      console.error("selectedList element not found in HTML");
      return;
    }
    
    updateSelectedPracticesDisplayWithContainer(displayContainer);
    
  } catch (error) {
    console.error("Error updating selected practices display:", error);
  }
}

// Helper function to actually update the display container
function updateSelectedPracticesDisplayWithContainer(displayContainer) {
  try {
    // Clear existing content
    displayContainer.innerHTML = '';
    
    if (!selectedPractices || selectedPractices.length === 0) {
      const emptyMessage = document.createElement('li');
      emptyMessage.textContent = 'No practices selected';
      emptyMessage.style.cssText = `
        color: #000;
        font-style: italic;
        list-style: none;
        padding: 10px;
        text-align: center;
      `;
      displayContainer.appendChild(emptyMessage);
      return;
    }
    
    selectedPractices.forEach((practice, index) => {
      const practiceItem = document.createElement('li');
      practiceItem.className = 'practice-item';
      practiceItem.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        margin: 5px 0;
        background: #f8f9fa;
        border-radius: 5px;
        border-left: 4px solid #007bff;
        list-style: none;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      
      const practiceInfo = document.createElement('span');
      const points = practice.isDoublePoints ? practice.points * 2 : practice.points;
      const doublePointsText = practice.isDoublePoints ? ' (2x)' : '';
      practiceInfo.textContent = `${practice.name} - ${points} pts${doublePointsText}`;
      practiceInfo.style.flex = '1';
      practiceInfo.style.color = '#000';
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.type = 'button'; // Prevent form submission
      removeBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        margin-left: 10px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      removeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedPractices.splice(index, 1);
        updateSelectedPracticesDisplay();
        console.log("Removed practice:", practice.name);
      };
      
      practiceItem.appendChild(practiceInfo);
      practiceItem.appendChild(removeBtn);
      displayContainer.appendChild(practiceItem);
    });
    
    // Add total points display as the last list item
    const totalPoints = selectedPractices.reduce((sum, practice) => {
      return sum + (practice.isDoublePoints ? practice.points * 2 : practice.points);
    }, 0);
    
    const totalDisplay = document.createElement('li');
    totalDisplay.style.cssText = `
      padding: 12px 15px;
      background: #e9ecef;
      border-radius: 5px;
      font-weight: bold;
      text-align: center;
      color: #000;
      border-top: 3px solid #007bff;
      list-style: none;
      margin-top: 10px;
    `;
    totalDisplay.textContent = `Total Points: ${totalPoints} | Total Practices: ${selectedPractices.length}`;
    
    displayContainer.appendChild(totalDisplay);
    
    console.log(`Updated display: ${selectedPractices.length} practices, ${totalPoints} total points`);
    
  } catch (error) {
    console.error("Error updating display container:", error);
  }
}

// FIXED: Function to add practice to selection (call this when a practice is selected)
function addPracticeToSelection(practice) {
  try {
    // Check if practice already exists
    const existingIndex = selectedPractices.findIndex(p => 
      p.name === practice.name || p.id === practice.id
    );
    
    if (existingIndex !== -1) {
      console.log("Practice already selected:", practice.name);
      showConfirmation("Practice already selected!", "yellow");
      return false;
    }
    
    // Add practice to selection
    selectedPractices.push(practice);
    console.log("Added practice to selection:", practice.name);
    
    // Update display
    updateSelectedPracticesDisplay();
    
    // Show confirmation
    showConfirmation(`Added: ${practice.name} (${practice.points} pts)`, "success");
    
    return true;
  } catch (error) {
    console.error("Error adding practice to selection:", error);
    return false;
  }
}

// Initialize display on page load
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for other scripts to load
  setTimeout(() => {
    if (window.selectedPractices) {
      updateSelectedPracticesDisplay();
    }
  }, 1000);
});

// Also update display when selectedPractices changes (if observable)
if (window.selectedPractices) {
  // Create a proxy to watch for changes if possible
  try {
    const originalPush = Array.prototype.push;
    const originalSplice = Array.prototype.splice;
    
    // Override push method
    selectedPractices.push = function(...items) {
      const result = originalPush.apply(this, items);
      updateSelectedPracticesDisplay();
      return result;
    };
    
    // Override splice method
    selectedPractices.splice = function(...args) {
      const result = originalSplice.apply(this, args);
      updateSelectedPracticesDisplay();
      return result;
    };
    
    console.log("Set up selectedPractices array monitoring");
  } catch (error) {
    console.warn("Could not set up array monitoring:", error);
  }
}

if (submitForm) {
  console.log("Submit form found, attaching event listener");
  
  submitForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    // Validation checks
    if (selectedPractices.length === 0) {
      showConfirmation("Please select at least one practice.", "red");
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!areSubmissionsAllowed(today)) {
      showConfirmation("Submissions are not allowed during tournament days.", "red");
      return;
    }
    
    // UI state management
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    
    try {
      // Authentication check
      const user = firebase.auth().currentUser;
      if (!user) {
        showConfirmation("You must be logged in to submit practices.", "red");
        return;
      }
      
      const userId = user.uid;
      const username = document.getElementById("golferName").value;
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Get daily submission ID
      const dailySubmissionId = await getDailySubmissionId(userId, currentDate);
      
      // CRITICAL: Get current daily points BEFORE making changes
      const previousDailyPoints = await getCurrentDailyPoints(userId, dailySubmissionId);
      console.log("Previous daily points:", previousDailyPoints);
      
      // Create batch operations
      const firestoreBatch = dbFirestore.batch();
      const realtimePromises = [];
      
      // Timestamps
      const firestoreTimestamp = firebase.firestore.FieldValue.serverTimestamp();
      const realtimeTimestamp = firebase.database.ServerValue.TIMESTAMP;
      
      // Create unique submission basket ID
      const submissionBasketId = `${currentDate}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Group practices by category
      const practicesByCategory = selectedPractices.reduce((acc, practice, index) => {
        const categoryKey = practice.category.toLowerCase();
        if (!acc[categoryKey]) {
          acc[categoryKey] = {
            categoryDisplayName: practice.categoryDisplay || practice.category,
            practices: []
          };
        }
        acc[categoryKey].practices.push({
          ...practice,
          originalIndex: index
        });
        return acc;
      }, {});

      // Process each category
      for (const [categoryKey, categoryData] of Object.entries(practicesByCategory)) {
        const categoryDocId = `${submissionBasketId}_${categoryKey}_${Date.now()}`;

        // Format practices for storage
        const practicesArray = categoryData.practices.map((practice, index) => {
          // Find full practice data
          let fullPracticeData = null;
          
          if (practicesData[categoryData.categoryDisplayName]) {
            fullPracticeData = practicesData[categoryData.categoryDisplayName].find(
              p => p.name === practice.name || p.name === practice.id
            );
          }
          
          if (!fullPracticeData) {
            for (const [catName, practices] of Object.entries(practicesData)) {
              fullPracticeData = practices.find(p => p.name === practice.name || p.name === practice.id);
              if (fullPracticeData) break;
            }
          }
          
          return {
            id: `practice_${index + 1}`,
            practiceItem: practice.id || practice.name.toLowerCase().replace(/\s+/g, '_'),
            name: fullPracticeData?.name || practice.name,
            description: fullPracticeData?.description || practice.name,
            practiceDescription: fullPracticeData?.description || practice.name,
            points: fullPracticeData?.points || practice.points,
            isDoublePoints: practice.isDoublePoints || false,
            submissionOrder: practice.originalIndex + 1,
            addedAt: Date.now(),
            isEdited: false,
            editHistory: [],
            originalPracticeData: fullPracticeData
          };
        });

        // Category submission data
        const firestoreSubmissionData = {
          username: username,
          golferName: username,
          userId: userId,
          date: currentDate,
          dailySubmissionId: dailySubmissionId,
          submissionBasketId: submissionBasketId,
          category: categoryKey,
          categoryDisplayName: categoryData.categoryDisplayName,
          practices: practicesArray,
          totalPractices: practicesArray.length,
          totalPoints: practicesArray.reduce((sum, p) => sum + (p.isDoublePoints ? p.points * 2 : p.points), 0),
          submittedAt: firestoreTimestamp,
          lastModified: firestoreTimestamp,
          timestamp: Date.now(),
          isDeleted: false,
          canEdit: true,
          canDelete: true,
          submissionType: 'practice',
          version: '1.0'
        };

        const realtimeSubmissionData = {
          ...firestoreSubmissionData,
          submittedAt: realtimeTimestamp,
          lastModified: realtimeTimestamp
        };

        // Add to batch/promises
        const firestoreRef = dbFirestore
          .collection('users')
          .doc(userId)
          .collection('practice_submissions')
          .doc(dailySubmissionId)
          .collection('categories')
          .doc(categoryDocId);

        const realtimeRef = dbRealtime
          .ref(`users/${userId}/practice_submissions/${dailySubmissionId}/categories/${categoryDocId}`);

        firestoreBatch.set(firestoreRef, firestoreSubmissionData);
        realtimePromises.push(realtimeRef.set(realtimeSubmissionData));
      }

      // Execute category submissions
      console.log("Executing database operations for categories...");
      await firestoreBatch.commit();
      await Promise.all(realtimePromises);

       // Filter for single-submission practices that were just submitted
      const singleSubmissionPractices = selectedPractices
        .filter(p => !practicesData[p.category].find(pd => pd.name === p.name)?.allowMultiple)
        .map(p => p.name);

      if (singleSubmissionPractices.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const dailyCompletionsRef = dbFirestore
            .collection("users").doc(userId)
            .collection("daily_completions").doc(today);

        // Use arrayUnion to add the new practice names to the document
        // This safely adds elements and prevents duplicates
        await dailyCompletionsRef.set({
          completed_practices: firebase.firestore.FieldValue.arrayUnion(...singleSubmissionPractices)
        }, { merge: true }); // Use merge:true to create the doc if it doesn't exist or update it if it does

        // Update the local array so the UI updates immediately without a page refresh
        todaysCompletedPractices.push(...singleSubmissionPractices);
        console.log("Updated daily completions in Firebase and locally.");
      }

      // Calculate NEW totals AFTER submission
      console.log("Calculating updated totals...");
      const { dailyTotalPoints, dailyTotalPractices, dailyTotalCategories } = await calculateDailyTotals(userId, dailySubmissionId);
      const { totalPoints: userTotalPoints, totalPractices: userTotalPractices } = await calculateUserTotals(userId);

      // CRITICAL: Calculate points difference
      const pointsDifference = dailyTotalPoints - previousDailyPoints;
      console.log(`Points difference: ${dailyTotalPoints} - ${previousDailyPoints} = ${pointsDifference}`);

      // Update or create daily submission metadata
      const metadataRef = dbFirestore
        .collection('users')
        .doc(userId)
        .collection('practice_submissions')
        .doc(dailySubmissionId);

      const existingMetadata = await metadataRef.get();

      if (existingMetadata.exists) {
        // UPDATE existing metadata
        console.log("Updating existing daily submission metadata...");
        
        const updateData = {
          totalCategories: dailyTotalCategories,
          totalPractices: dailyTotalPractices,
          totalPoints: dailyTotalPoints,
          userTotalPoints: userTotalPoints,
          userTotalPractices: userTotalPractices,
          lastModified: firestoreTimestamp,
          lastSubmissionAt: firestoreTimestamp
        };

        await metadataRef.update(updateData);

        // Update Realtime Database metadata
        const realtimeMetadataRef = dbRealtime
          .ref(`users/${userId}/practice_submissions/${dailySubmissionId}/metadata`);
        
        await realtimeMetadataRef.update({
          ...updateData,
          lastModified: realtimeTimestamp,
          lastSubmissionAt: realtimeTimestamp
        });

      } else {
        // CREATE new metadata document
        console.log("Creating new daily submission metadata...");
        
        const dailySubmissionMetadata = {
          dailySubmissionId: dailySubmissionId,
          date: currentDate,
          userId: userId,
          username: username,
          totalCategories: dailyTotalCategories,
          totalPractices: dailyTotalPractices,
          totalPoints: dailyTotalPoints,
          userTotalPoints: userTotalPoints,
          userTotalPractices: userTotalPractices,
          createdAt: firestoreTimestamp,
          submittedAt: firestoreTimestamp,
          lastModified: firestoreTimestamp,
          lastSubmissionAt: firestoreTimestamp,
          isActive: true
        };

        await metadataRef.set(dailySubmissionMetadata);

        // Create Realtime Database metadata
        const realtimeMetadataRef = dbRealtime
          .ref(`users/${userId}/practice_submissions/${dailySubmissionId}/metadata`);

        await realtimeMetadataRef.set({
          ...dailySubmissionMetadata,
          createdAt: realtimeTimestamp,
          submittedAt: realtimeTimestamp,
          lastModified: realtimeTimestamp,
          lastSubmissionAt: realtimeTimestamp
        });
      }

      // CRITICAL: Update totalUserScore based on points difference
      if (pointsDifference !== 0) {
        console.log("Updating totalUserScore...");
        await updateTotalUserScore(userId, pointsDifference);
      }

      // Success logging
      console.log("✅ All database operations completed successfully");
      console.log("📊 Daily Submission ID:", dailySubmissionId);
      console.log("📈 Daily Totals:", { dailyTotalPoints, dailyTotalPractices, dailyTotalCategories });
      console.log("🏆 User Lifetime Totals:", { userTotalPoints, userTotalPractices });
      console.log("⚡ totalUserScore updated by:", pointsDifference);

      // Show success message
      showConfirmation(
        `Successfully submitted! Points added: ${pointsDifference}`, 
        "green"
      );

      // Reset UI
      selectedPractices = [];
      updateSelectedPracticesDisplay();

      setTimeout(() => {
        if (taskCategory) {
          taskCategory.value = "";
          if (practiceContainer) {
            practiceContainer.classList.add("hidden");
          }
        }
      }, 2000);

    } catch (error) {
      console.error("❌ Error submitting practices:", error);
      showConfirmation("Failed to submit practices. Please try again.", "red");
    } finally {
      // Always re-enable the submit button
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Practice";
    }
  });
} else {
  console.error("❌ Submit form element not found!");
}

// ───────────────────────────────────────────────────────────
// 8) Edit Individual Practice Item - Updated to recalculate totals
// ───────────────────────────────────────────────────────────

async function editPracticeItem(userId, dailySubmissionId, categoryDocId, practiceId, updatedData) {
  try {
    const categoryRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId)
      .collection('categories')
      .doc(categoryDocId);
    
    // Get current document
    const doc = await categoryRef.get();
    if (!doc.exists) {
      throw new Error('Category document not found');
    }
    
    const data = doc.data();
    const practices = data.practices || [];
    
    // Find and update the specific practice
    const updatedPractices = practices.map(practice => {
      if (practice.id === practiceId) {
        // Add to edit history
        const editEntry = {
          editedAt: Date.now(),
          previousData: { ...practice },
          changes: updatedData
        };
        
        return {
          ...practice,
          ...updatedData,
          isEdited: true,
          editHistory: [...(practice.editHistory || []), editEntry]
        };
      }
      return practice;
    });
    
    // Recalculate category totals
    const categoryTotalPoints = updatedPractices.reduce((sum, p) => 
      sum + (p.isDoublePoints ? p.points * 2 : p.points), 0
    );
    
    // Update category document
    await categoryRef.update({
      practices: updatedPractices,
      totalPoints: categoryTotalPoints,
      totalPractices: updatedPractices.length,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Recalculate and update daily submission metadata
    const { dailyTotalPoints, dailyTotalPractices, dailyTotalCategories } = await calculateDailyTotals(userId, dailySubmissionId);
    const { totalPoints: userTotalPoints, totalPractices: userTotalPractices } = await calculateUserTotals(userId);
    
    const metadataRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId);
    
    await metadataRef.update({
      totalCategories: dailyTotalCategories,
      totalPractices: dailyTotalPractices,
      totalPoints: dailyTotalPoints,
      userTotalPoints: userTotalPoints,
      userTotalPractices: userTotalPractices,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Practice item updated successfully and totals recalculated');
    return true;
    
  } catch (error) {
    console.error('Error editing practice item:', error);
    return false;
  }
}
});
// ───────────────────────────────────────────────────────────
// 9) Delete Individual Practice Item - Updated to recalculate totals
// ───────────────────────────────────────────────────────────

async function deletePracticeItem(userId, dailySubmissionId, categoryDocId, practiceId) {
  try {
    const categoryRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId)
      .collection('categories')
      .doc(categoryDocId);
    
    // Get current document
    const doc = await categoryRef.get();
    if (!doc.exists) {
      throw new Error('Category document not found');
    }
    
    const data = doc.data();
    const practices = data.practices || [];
    
    // Remove the specific practice
    const updatedPractices = practices.filter(practice => practice.id !== practiceId);
    
    // If no practices left, delete entire category document
    if (updatedPractices.length === 0) {
      await categoryRef.delete();
      console.log('Category document deleted (no practices remaining)');
    } else {
      // Recalculate category totals
      const categoryTotalPoints = updatedPractices.reduce((sum, p) => 
        sum + (p.isDoublePoints ? p.points * 2 : p.points), 0
      );
      
      // Update category document
      await categoryRef.update({
        practices: updatedPractices,
        totalPractices: updatedPractices.length,
        totalPoints: categoryTotalPoints,
        lastModified: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Recalculate and update daily submission metadata
    const { dailyTotalPoints, dailyTotalPractices, dailyTotalCategories } = await calculateDailyTotals(userId, dailySubmissionId);
    const { totalPoints: userTotalPoints, totalPractices: userTotalPractices } = await calculateUserTotals(userId);
    
    const metadataRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId);
    
    await metadataRef.update({
      totalCategories: dailyTotalCategories,
      totalPractices: dailyTotalPractices,
      totalPoints: dailyTotalPoints,
      userTotalPoints: userTotalPoints,
      userTotalPractices: userTotalPractices,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Practice item deleted successfully and totals recalculated');
    return true;
    
  } catch (error) {
    console.error('Error deleting practice item:', error);
    return false;
  }
}

// ───────────────────────────────────────────────────────────
// 10) Delete Category Practice - Updated to recalculate totals
// ───────────────────────────────────────────────────────────
async function deleteCategorySubmission(userId, dailySubmissionId, categoryDocId) {
  try {
    const categoryRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId)
      .collection('categories')
      .doc(categoryDocId);
    
    // Soft delete option (mark as deleted)
    await categoryRef.update({
      isDeleted: true,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Or hard delete (completely remove)
    // await categoryRef.delete();
    
    // Recalculate and update daily submission metadata
    const { dailyTotalPoints, dailyTotalPractices, dailyTotalCategories } = await calculateDailyTotals(userId, dailySubmissionId);
    const { totalPoints: userTotalPoints, totalPractices: userTotalPractices } = await calculateUserTotals(userId);
    
    const metadataRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId);
    
    await metadataRef.update({
      totalCategories: dailyTotalCategories,
      totalPractices: dailyTotalPractices,
      totalPoints: dailyTotalPoints,
      userTotalPoints: userTotalPoints,
      userTotalPractices: userTotalPractices,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Category submission deleted successfully and totals recalculated');
    return true;
    
  } catch (error) {
    console.error('Error deleting category submission:', error);
    return false;
  }
}

// ───────────────────────────────────────────────────────────
// 11) Add Individual Practice Item To Category - Updated to recalculate totals
// ───────────────────────────────────────────────────────────
async function addPracticeToCategory(userId, dailySubmissionId, categoryDocId, newPractice) {
  try {
    const categoryRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId)
      .collection('categories')
      .doc(categoryDocId);
    
    // Get current document
    const doc = await categoryRef.get();
    if (!doc.exists) {
      throw new Error('Category document not found');
    }
    
    const data = doc.data();
    const practices = data.practices || [];
    
    // Create new practice entry
    const practiceEntry = {
      id: `practice_${practices.length + 1}`,
      practiceItem: newPractice.id || newPractice.name.toLowerCase().replace(/\s+/g, '_'),
      practiceDescription: newPractice.name,
      points: newPractice.points,
      isDoublePoints: newPractice.isDoublePoints || false,
      submissionOrder: practices.length + 1,
      addedAt: Date.now(),
      isEdited: false,
      editHistory: []
    };
    
    const updatedPractices = [...practices, practiceEntry];
    
    // Recalculate category totals
    const categoryTotalPoints = updatedPractices.reduce((sum, p) => 
      sum + (p.isDoublePoints ? p.points * 2 : p.points), 0
    );
    
    // Update category document
    await categoryRef.update({
      practices: updatedPractices,
      totalPractices: updatedPractices.length,
      totalPoints: categoryTotalPoints,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Recalculate and update daily submission metadata
    const { dailyTotalPoints, dailyTotalPractices, dailyTotalCategories } = await calculateDailyTotals(userId, dailySubmissionId);
    const { totalPoints: userTotalPoints, totalPractices: userTotalPractices } = await calculateUserTotals(userId);
    
    const metadataRef = dbFirestore
      .collection('users')
      .doc(userId)
      .collection('practice_submissions')
      .doc(dailySubmissionId);
    
    await metadataRef.update({
      totalCategories: dailyTotalCategories,
      totalPractices: dailyTotalPractices,
      totalPoints: dailyTotalPoints,
      userTotalPoints: userTotalPoints,
      userTotalPractices: userTotalPractices,
      lastModified: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Practice added to category successfully and totals recalculated');
    return true;
    
  } catch (error) {
    console.error('Error adding practice to category:', error);
    return false;
  }
}

// ───────────────────────────────────────────────────────────
// 12) Helper to show messages
// ───────────────────────────────────────────────────────────
function showConfirmation(message, color) {
  const confirmationDiv = document.getElementById("confirmationMessage");
  
  if (!confirmationDiv) {
    console.error("Confirmation message element not found!");
    return;
  }
  
  // Set the message and styling
  confirmationDiv.textContent = message;
  confirmationDiv.style.backgroundColor = color === "green" ? "rgba(76, 175, 80, 0.8)" :
                                        color === "red" ? "rgba(244, 67, 54, 0.8)" :
                                        color === "blue" ? "rgba(33, 150, 243, 0.8)" : color;
  confirmationDiv.style.color = "white";
  
  // Show the message
  confirmationDiv.classList.remove("hidden");
  
  // Force a reflow to restart animation if we add it
  void confirmationDiv.offsetWidth;
  
  // Add animation class if not already present
  if (!confirmationDiv.classList.contains("fade-in-out")) {
    confirmationDiv.classList.add("fade-in-out");
  }
  
  // Hide after a delay
  setTimeout(() => {
    confirmationDiv.classList.add("hidden");
  }, 3000);
}

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