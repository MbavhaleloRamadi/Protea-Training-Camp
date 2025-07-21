// history.js

document.addEventListener("DOMContentLoaded", function () {
  let allSubmissions = [];
  let filteredSubmissions = [];
  let currentEditingPracticeId = null;
  let currentEditingSubmissionId = null;
  let currentEditingCategoryId = null;
  let currentViewingSubmission = null;

  // ───────────────────────────────────────────────────────────
  // 1) PAGE LOADER
  // ───────────────────────────────────────────────────────────
  setTimeout(() => {
    document.body.style.visibility = "visible";
    const loaderOverlay = document.getElementById("loaderOverlay");
    loaderOverlay.style.opacity = "0";
    setTimeout(() => {
      loaderOverlay.style.display = "none";
    }, 600);
  }, 1000);

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
    measurementId: "G-K1HKHPG6HG",
  };

  if (!window.firebase) {
    console.error("Firebase SDK not found.");
    const historyContainer = document.querySelector(".history-container");
    if (historyContainer) {
      historyContainer.innerHTML = `
          <div class="error-message">
            <h2>Connection Error</h2>
            <p>Could not connect to the practice database. Please try again later.</p>
            <button class="back-button" onclick="window.location.reload()">
              <i class="fas fa-sync"></i> Retry
            </button>
          </div>
        `;
    }
    return;
  }

  // Initialize Firebase if not already initialized
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // Reference to Firestore and Auth
  const db = firebase.firestore();
  const auth = firebase.auth();
  const realtimeDb = firebase.database(); // Renamed for clarity with db

  // ───────────────────────────────────────────────────────────
  // 3) AUTH CHECK
  // ───────────────────────────────────────────────────────────
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log("User logged in:", user.uid);
      fetchUserSubmissions(user.uid);
    } else {
      console.log("No user logged in");
      document.querySelector(".history-container").classList.add("hidden");
      document.getElementById("emptyState").classList.remove("hidden");
      document.getElementById("emptyState").innerHTML = `
          <img src="assets/icon/version-svgrepo-com.svg" alt="Login required">
          <h3>Login Required</h3>
          <p>Please login to view your practice history.</p>
          <a href="login.html" class="start-btn">Login</a>
        `;
    }
  });

  // ───────────────────────────────────────────────────────────
  // 4) FETCH USER SUBMISSIONS DATA - UPDATED FOR NEW STRUCTURE
  // ───────────────────────────────────────────────────────────
  async function fetchUserSubmissions(userId) {
    try {
      const userSubmissionsRef = db
        .collection("users")
        .doc(userId)
        .collection("practice_submissions");
      const snapshot = await userSubmissionsRef.orderBy("date", "desc").get();

      if (snapshot.empty) {
        console.log("No practice submissions found");
        document.querySelector(".history-container").classList.add("hidden");
        document.getElementById("emptyState").classList.remove("hidden");
        return;
      }

      const submissions = [];

      for (const doc of snapshot.docs) {
        const submissionData = doc.data();
        console.log("Processing submission:", doc.id, submissionData);

        // Check if this is a metadata document (has dailySubmissionId field)
        if (!submissionData.dailySubmissionId) {
          console.log("Skipping non-metadata document:", doc.id);
          continue;
        }

        // Skip if the daily submission itself is marked as deleted/inactive
        if (
          submissionData.isDeleted === true ||
          submissionData.isActive === false
        ) {
          console.log("Skipping deleted/inactive daily submission:", doc.id);
          continue;
        }

        // Get categories for this daily submission
        const categoriesSnapshot = await doc.ref.collection("categories").get();
        const categories = [];

        for (const catDoc of categoriesSnapshot.docs) {
          const categoryData = catDoc.data();

          // Skip deleted categories
          if (categoryData.isDeleted) {
            continue;
          }

          const practices = categoryData.practices || [];

          categories.push({
            id: catDoc.id,
            name: categoryData.categoryDisplayName || categoryData.category,
            categoryKey: categoryData.category,
            practices: practices,
            totalPoints: categoryData.totalPoints || 0,
            totalPractices: categoryData.totalPractices || practices.length,
            submittedAt: categoryData.submittedAt,
            lastModified: categoryData.lastModified,
          });
        }

        // Create submission object from metadata + categories
        const submission = {
          id: doc.id, // This is the dailySubmissionId from the metadata doc
          dailySubmissionId: submissionData.dailySubmissionId,
          date: submissionData.date,
          submittedAt: submissionData.submittedAt || submissionData.createdAt,
          lastModified: submissionData.lastModified,
          totalCategories: submissionData.totalCategories || categories.length,
          totalPoints: submissionData.totalPoints || 0,
          totalPractices: submissionData.totalPractices || 0,
          userTotalPoints: submissionData.userTotalPoints || 0, // This is expected to be managed at the user root, but stored here for context
          userTotalPractices: submissionData.userTotalPractices || 0, // Same as above
          categories: categories,
          categorySummary: categories.map((cat) => cat.name).join(", "),
          isActive: submissionData.isActive !== false, // Default to true if not specified
        };

        // Only add submissions that have categories or are explicitly marked as active
        if (categories.length > 0 || submission.isActive) {
          submissions.push(submission);
        }
      }

      if (submissions.length === 0) {
        console.log("No valid submissions found after processing");
        document.querySelector(".history-container").classList.add("hidden");
        document.getElementById("emptyState").classList.remove("hidden");
      } else {
        console.log(`Found ${submissions.length} valid submissions`);
        allSubmissions = submissions;
        filteredSubmissions = [...allSubmissions]; // Re-initialize filtered submissions
        initializePage(submissions);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
      document.querySelector(".history-container").innerHTML = `
      <div class="error-message">
        <h2>Error Loading Data</h2>
        <p>Could not load your practice history. Please try again later.</p>
        <p>Error: ${error.message}</p>
        <button class="back-button" onclick="window.location.reload()">
          <i class="fas fa-sync"></i> Retry
        </button>
      </div>
    `;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 5) INITIALIZE PAGE FUNCTIONS - UPDATED FOR NEW DATA STRUCTURE
  // ───────────────────────────────────────────────────────────
  function initializePage(data) {
    updateStats(data);
    populateMostPracticed(data);
    populateCategoryFilter(data); // Populate category filter dropdown
    populateSubmissionsTimeline(data);
    setupExportButtons(data);
    setupDateRangeFilters(); // Setup date range listeners
  }

  function updateStats(data) {
    // Ensure data is active for stats calculation
    const activeData = data.filter(
      (s) => s.isActive !== false && s.isDeleted !== true
    );

    const totalSubmissions = activeData.length;

    // Calculate total practices from metadata (more accurate)
    const totalPractices = activeData.reduce(
      (sum, submission) => sum + (submission.totalPractices || 0),
      0
    );

    document.getElementById("totalPractices").textContent = totalPractices;

    let currentStreak = calculateCurrentStreak(activeData);
    document.getElementById("currentStreak").textContent = currentStreak;

    let longestStreak = calculateLongestStreak(activeData);
    document.getElementById("longestStreak").textContent = longestStreak;

    // Update the stat card titles to be more accurate
    // Assuming these are the default titles, they might already be set in HTML
    // document.querySelector('.stat-card h3').textContent = 'Total Practices';
    // document.querySelector('.stat-card .stat-detail').textContent = 'Individual practices completed';

    console.log(
      `Stats updated: ${totalPractices} practices, ${currentStreak} current streak, ${longestStreak} longest streak`
    );
  }

  function calculateCurrentStreak(data) {
    if (data.length === 0) return 0;

    const sortedData = [...data].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from the most recent date
    for (let i = 0; i < sortedData.length; i++) {
      const submissionDate = new Date(sortedData[i].date);
      submissionDate.setHours(0, 0, 0, 0);

      let expectedDate;
      if (i === 0) {
        // First submission should be today or yesterday
        expectedDate = new Date(today);
        const daysDiff = Math.floor(
          (today - submissionDate) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 1) {
          // If it's not today or yesterday
          break; // Gap too large, no current streak
        } else if (
          daysDiff === 1 &&
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - 1
          ).getTime() !== submissionDate.getTime()
        ) {
          // If it was yesterday, but the "today" check already failed for being a day after
          break;
        }
        streak = 1;
      } else {
        // Subsequent submissions should be consecutive days
        const prevDate = new Date(sortedData[i - 1].date);
        prevDate.setHours(0, 0, 0, 0);
        expectedDate = new Date(prevDate.getTime() - 24 * 60 * 60 * 1000); // Previous day

        if (submissionDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else if (submissionDate.getTime() < expectedDate.getTime()) {
          // Already processed older date, continue or break if not consecutive
          break;
        }
      }
    }

    return streak;
  }

  function calculateLongestStreak(data) {
    if (data.length === 0) return 0;

    const sortedData = [...data].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    let currentStreak = 1;
    let maxStreak = 1;

    if (sortedData.length > 0) {
      // Ensure there's at least one submission
      maxStreak = 1;
    } else {
      return 0; // No submissions, no streak
    }

    for (let i = 0; i < sortedData.length - 1; i++) {
      const currentDate = new Date(sortedData[i].date);
      currentDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(sortedData[i + 1].date);
      nextDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (nextDate - currentDate) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (diffDays > 1) {
        // Gap found, reset streak
        currentStreak = 1;
      }
      // If diffDays is 0, it means multiple submissions on the same day, streak continues.
    }

    return maxStreak;
  }

  function populateMostPracticed(data) {
    const container = document.getElementById("mostPracticedContainer");
    container.innerHTML = "";

    const categoryCount = {};
    const categoryPoints = {};

    // Count category occurrences and total points
    data.forEach((submission) => {
      submission.categories.forEach((category) => {
        const categoryName = category.name;
        categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
        categoryPoints[categoryName] =
          (categoryPoints[categoryName] || 0) + (category.totalPoints || 0);
      });
    });

    const sortedCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Show top 5 instead of 3

    const totalSubmissions = data.length;
    const categoriesToShow = sortedCategories.filter((c) => c[1] >= 1); // Show categories with at least 1 submission

    if (categoriesToShow.length === 0) {
      container.innerHTML = `
      <div class="empty-state" style="padding: 20px; color: #bdbdbd;">
        <p>No categories have been practiced yet.</p>
      </div>
    `;
      return;
    }

    categoriesToShow.forEach(([categoryName, count]) => {
      const percentage = Math.round((count / totalSubmissions) * 100);
      const totalPoints = categoryPoints[categoryName] || 0;

      const categoryEl = document.createElement("div");
      categoryEl.className = "practice-progress";
      categoryEl.innerHTML = `
      <h3>${categoryName}</h3>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${Math.min(
          percentage,
          100
        )}%"></div>
        <span class="progress-text">${count} times (${totalPoints} pts)</span>
      </div>
    `;

      container.appendChild(categoryEl);
    });
  }

  const practicesData = {
    Putting: [
      {
        name: "Putt-30/1",
        description: "Putt 30 Balls longer than 1 Metres",
        points: 5,
      },
      {
        name: "Putt-30/2",
        description: "Putt 30 Balls longer than 2 Metres",
        points: 5,
      },
      {
        name: "Putt-30/3",
        description: "Putt 30 Balls longer than 3 Metres",
        points: 5,
      },
      {
        name: "Putt-Drain10/1",
        description: "Drain 10 Consecutive Putts Longer than 1 Metre",
        points: 5,
      },
      {
        name: "Putt-Drain10/2",
        description: "Drain 10 Consecutive Putts Longer than 2 Metres",
        points: 10,
      },
      {
        name: "Putt-Under36",
        description:
          "Practise under 36 putts (2 putt average) for 18 different holes longer than 3 metres",
        points: 15,
      },
      {
        name: "Putt-CircleGame",
        description:
          "4 Balls in a circle around hole longer than 2 metres, drain consecutive 5 rounds",
        points: 15,
      },
      {
        name: "Putt-ClockGame",
        description:
          "Finish the clock game - 12 Putts in circle from 0.5m + 1m + 1.5m (All 3 Distances)",
        points: 15,
      },
      {
        name: "Putt-MatchPlay",
        description:
          "Win against another player Matchplay 18 Holes on Practice Green",
        points: 25,
      },
      {
        name: "Putt-Distance",
        description:
          "Set up a landing zone (10cm deep) at least 10 metres away, putt 10 consecutive putts in the landing zone",
        points: 25,
      },
      {
        name: "Putt-Drain20/5",
        description: "Drain 20 Consecutive Putts Longer than 5 Metres",
        points: 25,
      },
    ],
    Chipping: [
      {
        name: "Chip-30/3",
        description: "Chip 30 Balls between 2-5 Metres (to satisfaction)",
        points: 5,
      },
      {
        name: "Chip-30/6",
        description: "Chip 30 Balls between 5-10 Metres (to satisfaction)",
        points: 5,
      },
      {
        name: "Chip-L30",
        description:
          "Hit 30 clean strikes with the Lobwedge between 10 - 20 Metres",
        points: 10,
      },
      {
        name: "Chip-S30",
        description:
          "Hit 30 clean strikes with the Sandwedge between 10 - 20 Metres",
        points: 10,
      },
      {
        name: "Chip-P30",
        description:
          "Hit 30 clean strikes with the Pitching Wedge between 10-20 Metres",
        points: 10,
      },
      {
        name: "Chip-Bump& Run",
        description: "Bump & Run 30 balls (Flight 1-2 Metres) (Run 3-5Metres)",
        points: 10,
      },
      {
        name: "Chip-Bunker",
        description: "Hit 30 clean greenside bunker shots (to satisfaction)",
        points: 15,
      },
      {
        name: "Chip-Drain5/6",
        description:
          "Drain 5 Consecutive Chip Shots into a bucket longer than 6 Metres",
        points: 15,
      },
      {
        name: "Flop30",
        description:
          "Flop 30 clean strikes with a flight above 2metres and within 5 Metres",
        points: 15,
      },
      {
        name: "FlagHIT",
        description:
          "Hit the flag 3 consecutive times outside 3 metres with any wedge club",
        points: 25,
      },
      {
        name: "Chip-MatchPlay",
        description:
          "Win against another player Matchplay 18 Holes on Chip Shots",
        points: 25,
      },
    ],
    "Irons & Tee Shot": [
      {
        name: "Irons-9i/30",
        description:
          "Hit 30 clean strikes with the 9i over 100m (to satisfaction)",
        points: 5,
      },
      {
        name: "Irons-8i/30",
        description:
          "Hit 30 clean strikes with the 8i over 100m (to satisfaction)",
        points: 5,
      },
      {
        name: "Irons-5w/30",
        description:
          "Hit 30 clean strikes with the 5wood over 150m (to satisfaction)",
        points: 5,
      },
      {
        name: "Fairway-3w/30",
        description:
          "Hit 30 clean strikes with the 3wood over 150m (to satisfaction)",
        points: 5,
      },
      {
        name: "Driver-30",
        description:
          "Hit 30 clean strikes with the Driver over 150m (to satisfaction)",
        points: 5,
      },
      {
        name: "Bucket",
        description:
          "Hit a full bucket (minimum 50 balls) on a driving range 9i-5i (only)",
        points: 5,
      },
      {
        name: "Irons-7i/30",
        description:
          "Hit 30 clean strikes with the 7i over 120m (to satisfaction)",
        points: 10,
      },
      {
        name: "Irons-6i/30",
        description:
          "Hit 30 clean strikes with the 6i over 120m (to satisfaction)",
        points: 10,
      },
      {
        name: "Irons-5i/30",
        description:
          "Hit 30 clean strikes with the 5i over 120m (to satisfaction)",
        points: 10,
      },
      {
        name: "Irons-Approach",
        description:
          "Hit 20 consecutive Targets between 120m - 160m (to satisfaction)",
        points: 15,
      },
      {
        name: "9i-in9",
        description: "Play 9 Holes on a course with Irons & Putter only",
        points: 25,
      },
      {
        name: "Fairway-Bunker",
        description:
          "Hit 30 clean strikes out of a fairway bunker over 120 metres",
        points: 25,
      },
    ],
    Mental: [
      { name: "Mind-Chess", description: "Play a game of chess", points: 3 },
      {
        name: "Mind-Juggle",
        description: "Learn to Juggle for 60mins",
        points: 3,
      },
      {
        name: "Mind-Affirmation",
        description:
          "Write down 10 different reasons why you want to win the Guarra Guarra 2025",
        points: 3,
      },
      { name: "Mind Calmness", description: "Medidate for 30mins", points: 3 },
      {
        name: "Mind Soduko",
        description: "Complete a game of Sudoko",
        points: 3,
      },
      {
        name: "Mind Reflect",
        description:
          "Compile a list of 5 different weaknesses in your game and how to improve each one",
        points: 3,
      },
      {
        name: "Mind Achive",
        description:
          "Complete 5 improvements to weaknesses previously listed (to satisfaction)",
        points: 5,
      },
      {
        name: "Mind Putt Routine",
        description:
          "Set up a Pre Shot Putting Routine (Practice the preshot PUTTING routine 30 times)",
        points: 5,
      },
      {
        name: "Mind Shot Routine",
        description:
          "Set up a Pre Shot Routine (Practice the preshot routine 30 times)",
        points: 5,
      },
      {
        name: "Mind Control",
        description: "Excersixe full deep breathing excersises for 30mins",
        points: 10,
      },
      {
        name: "Mind Learn",
        description:
          "Complete any Book or Audio Book by Dr Bob Rotella (minimum 100minutes)",
        points: 25,
      },
    ],
    "On The Course": [
      {
        name: "OTC-Quick9",
        description: "Play 9 holes on an official Golf Course",
        points: 5,
      },
      {
        name: "OTC-Myball",
        description: "Finish with the Ball you started",
        points: 5,
      },
      {
        name: "OTC-Partime",
        description: "Score a Par on a Hole (unlimitted per day)",
        points: 5,
        allowMultiple: true,
      },
      {
        name: "OTC-Par3",
        description: "Score a par or lower on a par 3 (unlimitted per day)",
        points: 5,
        allowMultiple: true,
      },
      {
        name: "OTC-Up&Down",
        description:
          "Score an Up&Down for par or lower out of a greenside bunker (unlimitted per day)",
        points: 5,
        allowMultiple: true,
      },
      {
        name: "OTC-Full18",
        description: "Play 18 holes on an official Golf Course",
        points: 10,
      },
      {
        name: "OTC-Birdies",
        description: "Score a Birdie on a Hole (unlimitted per day)",
        points: 10,
        allowMultiple: true,
      },
      {
        name: "OTC-Fairways4days",
        description: "Hit 75% Fairways in regulation",
        points: 10,
      },
      {
        name: "OTC-Deadaim",
        description: "Hit 50% Greens in regulation",
        points: 10,
      },
      {
        name: "OTC-MrPutt",
        description: "Score average of 2 putts or less per hole",
        points: 10,
      },
      {
        name: "OTC-Beatme",
        description: "Score below your course handicap",
        points: 15,
      },
      {
        name: "OTC-Eagle",
        description: "Score an Eagle (unlimitted per day)",
        points: 25,
        allowMultiple: true,
      },
    ],
    "Tournament Prep": [
      {
        name: "TP-Visualize",
        description:
          "Map out a hole of Magalies park golf course, Distances, Obstacles, Stroke, Par, Gameplan",
        points: 5,
      },
      {
        name: "TP-Recon",
        description:
          "Create a player card of an opposing player with strengths, weaknesses, hcp performance etc.",
        points: 5,
      },
      {
        name: "TP-Teamwork",
        description:
          "Play a full game under any of the Tournament formats (Matchplay, Betterball, Scramble Drive, Foursomes)",
        points: 10,
      },
      {
        name: "TP-Social",
        description:
          "Attend any of the Training Camp Socials (Quiz Night, Iron Play, Driving Range Games etc.)",
        points: 10,
      },
      {
        name: "TP-Gametime",
        description: "Play 18 Holes at Magaliespark Golf Course",
        points: 15,
      },
      {
        name: "TP-Highstakes",
        description:
          "Play a highstakes 9 hole competition for minimum R100 against another player or team",
        points: 15,
      },
      {
        name: "TP-Puttoff",
        description:
          "Play a highstakes 10Hole Putt off Matchplay competition for minimum R100 against another player",
        points: 15,
      },
    ],
    Fitness: [
      {
        name: "Fit-50 Push Ups",
        description: "Do 50 or more push ups",
        points: 5,
      },
      {
        name: "Fit-50 Situps",
        description: "Do 50 or more sit ups",
        points: 5,
      },
      { name: "Fit-Run2k", description: "Run over 2km", points: 5 },
      {
        name: "Fit-Gym30",
        description: "Do weight training for minimum 30mins",
        points: 5,
      },
      {
        name: "Fit-Stretch",
        description: "Stretch or yoga for minimum 30mins",
        points: 5,
      },
      { name: "Fit-Run5k", description: "Run over 5km", points: 10 },
      {
        name: "Fit-Walk9",
        description: "Walk for 9 holes game on an official golf course",
        points: 10,
      },
      {
        name: "Fit-Walk18",
        description: "Walk for 18 holes game on an official golf course",
        points: 15,
      },
      {
        name: "Fit-Gettingbetter",
        description: "Receive 5 Professional Golf Lessons",
        points: 25,
      },
      { name: "Fit-Run10k", description: "Run 10km or more", points: 25 },
    ],
  };

  // ───────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS FOR REAL-TIME SYNC
  // ───────────────────────────────────────────────────────────

  /**
   * Recalculates daily submission totals based on its categories.
   * Skips categories marked as isDeleted.
   */
  async function calculateDailyTotals(
    userId,
    dailySubmissionId,
    firestoreDb = db,
    realtimeDbRef = realtimeDb
  ) {
    let totalPoints = 0;
    let totalPractices = 0;
    let totalCategories = 0;

    // Fetch categories from Firestore
    const categoriesSnapshot = await firestoreDb
      .collection("users")
      .doc(userId)
      .collection("practice_submissions")
      .doc(dailySubmissionId)
      .collection("categories")
      .get();

    categoriesSnapshot.forEach((catDoc) => {
      const categoryData = catDoc.data();
      if (categoryData.isDeleted !== true) {
        // Only count active categories
        totalPoints += categoryData.totalPoints || 0;
        totalPractices += categoryData.totalPractices || 0;
        totalCategories++;
      }
    });

    return { totalPoints, totalPractices, totalCategories };
  }

  /**
   * Recalculates user's total points and practices from all active daily submissions.
   * Skips daily submissions marked as isDeleted or isActive: false.
   */
  async function calculateUserTotals(
    userId,
    firestoreDb = db,
    realtimeDbRef = realtimeDb
  ) {
    let totalPoints = 0;
    let totalPractices = 0;

    const submissionsSnapshot = await firestoreDb
      .collection("users")
      .doc(userId)
      .collection("practice_submissions")
      .get();

    submissionsSnapshot.forEach((dailySubDoc) => {
      const dailySubmissionData = dailySubDoc.data();
      // Only count if it's a metadata document AND not deleted/inactive
      if (
        dailySubmissionData.dailySubmissionId &&
        dailySubmissionData.isDeleted !== true &&
        dailySubmissionData.isActive !== false
      ) {
        totalPoints += dailySubmissionData.totalPoints || 0;
        totalPractices += dailySubmissionData.totalPractices || 0;
      }
    });
    return { totalPoints, totalPractices };
  }

  /**
   * Updates a specific practice in the allSubmissions array
   * This ensures all UI components stay in sync
   */
  function updatePracticeInLocalData(
    submissionId,
    categoryId,
    practiceIndex,
    updatedPractice
  ) {
    const submission = allSubmissions.find((s) => s.id === submissionId);
    if (!submission) return false;

    const category = submission.categories.find((c) => c.id === categoryId);
    if (!category) return false;

    if (!category.practices[practiceIndex]) return false;

    // Update the practice
    category.practices[practiceIndex] = {
      ...category.practices[practiceIndex],
      ...updatedPractice,
    };

    // Recalculate category totals
    category.totalPoints = category.practices.reduce(
      (sum, p) => sum + (p.points || 0),
      0
    );
    category.totalPractices = category.practices.length;

    // Recalculate submission totals (sum of all category totals in this daily submission)
    submission.totalPoints = submission.categories.reduce(
      (sum, cat) => sum + cat.totalPoints,
      0
    );
    submission.totalPractices = submission.categories.reduce(
      (sum, cat) => sum + cat.totalPractices,
      0
    );
    submission.totalCategories = submission.categories.filter(
      (cat) => cat.isDeleted !== true
    ).length; // Only count active categories

    // Update category summary for timeline display
    submission.categorySummary = submission.categories
      .filter((cat) => cat.isDeleted !== true)
      .map((cat) => cat.name)
      .join(", ");

    return true;
  }

  /**
   * Refreshes all UI components that display practice data
   */
  async function refreshAllUIComponents(userId) {
    await fetchUserSubmissions(userId || auth.currentUser.uid); // Re-fetch all data
    // The initializePage function (called by fetchUserSubmissions) will then re-render everything
    console.log("All UI components refreshed.");
  }

  /**
   * Updates a specific timeline item without full refresh
   * Shows detailed information about categories, practices, and points
   */
  function updateTimelineItem(submissionId) {
    const timelineItem = document.querySelector(
      `[data-submission-id="${submissionId}"]`
    );
    if (!timelineItem) return;

    const submission = allSubmissions.find((s) => s.id === submissionId);
    if (
      !submission ||
      submission.isDeleted === true ||
      submission.isActive === false
    ) {
      // If submission is now deleted or inactive, remove it from the DOM
      timelineItem.remove();
      return;
    }

    // Format the date
    const date = new Date(submission.date);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Format submission time
    let timeInfo = "";
    if (submission.submittedAt && submission.submittedAt.toDate) {
      const submittedTime = submission.submittedAt.toDate();
      timeInfo = ` at ${submittedTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (submission.submittedAt) {
      // Handle cases where it might just be a timestamp number
      const submittedTime = new Date(submission.submittedAt);
      timeInfo = ` at ${submittedTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    // Generate detailed category breakdown
    let categoryBreakdown = "";
    const activeCategories = submission.categories.filter(
      (cat) => cat.isDeleted !== true
    ); // Only active categories for display
    activeCategories.forEach((category, index) => {
      const practices = category.practices || [];
      const practicesList = practices
        .map((practice) => {
          const practiceName =
            practice.name || practice.practiceDescription || "Unnamed Practice";
          const practicePoints = practice.isDoublePoints
            ? (practice.points || 0) * 2
            : practice.points || 0;
          const isEditedText = practice.isEdited ? " (Edited)" : "";
          return `${practiceName} (${practicePoints}pts)${isEditedText}`;
        })
        .join(", ");

      categoryBreakdown += `
      <div class="category-breakdown">
        <strong>${category.name}:</strong>
        <span class="category-stats-inline">${practices.length} practices, ${
        category.totalPoints || 0
      } points</span>
        ${
          practices.length > 0
            ? `<div class="practices-list-inline">${practicesList}</div>`
            : ""
        }
      </div>
    `;
    });

    // Update the entire timeline item content
    timelineItem.innerHTML = `
    <div class="timeline-date">${formattedDate}${timeInfo}</div>
    <div class="timeline-content">
      <div class="submission-header">
        <h3>Practice Session</h3>
        <div class="submission-actions">
          <button class="view-details-btn" onclick="viewSubmissionDetails('${
            submission.id
          }')">
            <i class="fas fa-eye"></i> View Details
          </button>
        </div>
      </div>
      <div class="submission-summary">
        <div class="submission-stats">
          <span><i class="fas fa-list"></i> ${
            submission.totalCategories || 0
          } Categories</span>
          <span><i class="fas fa-dumbbell"></i> ${
            submission.totalPractices || 0
          } Practices</span>
          <span><i class="fas fa-star"></i> ${
            submission.totalPoints || 0
          } Points</span>
        </div>
        <div class="detailed-breakdown">
          ${categoryBreakdown}
        </div>
      </div>
    </div>
  `;

    // Add some inline styles for better presentation if they don't exist in CSS
    const style = document.createElement("style");
    if (!document.getElementById("timeline-update-styles")) {
      style.id = "timeline-update-styles";
      style.textContent = `
      .category-breakdown {
        margin: 8px 0;
        padding: 6px;
        background: rgba(0,0,0,0.05);
        border-radius: 4px;
        font-size: 0.9em;
      }
      .category-stats-inline {
        color: #666;
        font-size: 0.85em;
      }
      .practices-list-inline {
        margin-top: 4px;
        font-size: 0.8em;
        color: #888;
        line-height: 1.3;
      }
      .detailed-breakdown {
        margin-top: 10px;
      }
      .submission-stats {
        margin-bottom: 10px;
      }
    `;
      document.head.appendChild(style);
    }

    console.log(`Timeline item updated for submission: ${submissionId}`);
  }

  // ───────────────────────────────────────────────────────────
  // EDIT PRACTICE FUNCTIONALITY
  // ───────────────────────────────────────────────────────────

  window.editPractice = function (submissionId, categoryId, practiceIndex) {
    const submission = allSubmissions.find((s) => s.id === submissionId);
    if (!submission) {
      showNotification("Submission not found", "error");
      return;
    }

    const category = submission.categories.find((c) => c.id === categoryId);
    if (!category) {
      showNotification("Category not found", "error");
      return;
    }

    const practice = category.practices[practiceIndex];
    if (!practice) {
      showNotification("Practice not found", "error");
      return;
    }

    currentEditingSubmissionId = submissionId;
    currentEditingCategoryId = categoryId;
    currentEditingPracticeId = practiceIndex;

    showEditPracticeModal(practice);
  };

  function showEditPracticeModal(practice) {
    // Create or update edit modal
    let modal = document.getElementById("editPracticeModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "editPracticeModal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    // Generate category options
    let categoryOptions = "";
    let selectedCategory = "";

    // Find which category contains the current practice
    for (const [categoryName, practices] of Object.entries(practicesData)) {
      const foundPractice = practices.find((p) => p.name === practice.name);
      if (foundPractice) {
        selectedCategory = categoryName;
      }
      categoryOptions += `<option value="${categoryName}" ${
        categoryName === selectedCategory ? "selected" : ""
      }>${categoryName}</option>`;
    }

    // Generate practice options for the selected category
    let practiceOptions = "";
    if (selectedCategory && practicesData[selectedCategory]) {
      practicesData[selectedCategory].forEach((p) => {
        const selected = p.name === practice.name ? "selected" : "";
        practiceOptions += `<option value="${p.name}" data-description="${p.description}" data-points="${p.points}" ${selected}>${p.name}</option>`;
      });
    }

    modal.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h3>Edit Practice</h3>
        <button class="modal-close" onclick="closeEditPracticeModal()" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <form id="editPracticeForm" onsubmit="event.preventDefault(); saveEditedPractice();">
          <div class="form-group">
            <label for="editPracticeCategory">Category</label>
            <select id="editPracticeCategory" onchange="updatePracticeOptions()" required>
              <option value="">Select Category</option>
              ${categoryOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="editPracticeName">Practice</label>
            <select id="editPracticeName" onchange="updatePracticeDetails()" required>
              <option value="">Select Practice</option>
              ${practiceOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="editPracticeDescription">Description</label>
            <textarea id="editPracticeDescription" rows="3" readonly>${
              practice.description || ""
            }</textarea>
          </div>

          <div class="form-group">
            <label for="editPracticePoints">Points</label>
            <input type="number" id="editPracticePoints" value="${
              practice.points || 0
            }" min="0" readonly>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeEditPracticeModal()">
              Cancel
            </button>
            <button type="submit" class="btn-primary">
              <i class="fas fa-save"></i> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

    // Set higher z-index to appear in front of the details modal
    modal.style.zIndex = "1001";
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }

  window.closeEditPracticeModal = function () {
    const modal = document.getElementById("editPracticeModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.style.zIndex = ""; // Reset z-index
    }
    currentEditingSubmissionId = null;
    currentEditingCategoryId = null;
    currentEditingPracticeId = null;
  };

  // Helper function to update practice options when category changes
  window.updatePracticeOptions = function () {
    const categorySelect = document.getElementById("editPracticeCategory");
    const practiceSelect = document.getElementById("editPracticeName");
    const descriptionTextarea = document.getElementById(
      "editPracticeDescription"
    );
    const pointsInput = document.getElementById("editPracticePoints");

    if (!categorySelect || !practiceSelect) return;

    const selectedCategory = categorySelect.value;

    // Clear current options
    practiceSelect.innerHTML = '<option value="">Select Practice</option>';
    descriptionTextarea.value = "";
    pointsInput.value = 0;

    if (selectedCategory && practicesData[selectedCategory]) {
      practicesData[selectedCategory].forEach((practice) => {
        const option = document.createElement("option");
        option.value = practice.name;
        option.textContent = practice.name;
        option.setAttribute("data-description", practice.description);
        option.setAttribute("data-points", practice.points);
        practiceSelect.appendChild(option);
      });
    }
  };

  // Helper function to update description and points when practice changes
  window.updatePracticeDetails = function () {
    const practiceSelect = document.getElementById("editPracticeName");
    const descriptionTextarea = document.getElementById(
      "editPracticeDescription"
    );
    const pointsInput = document.getElementById("editPracticePoints");

    if (!practiceSelect || !descriptionTextarea || !pointsInput) return;

    const selectedOption = practiceSelect.options[practiceSelect.selectedIndex];

    if (selectedOption && selectedOption.value) {
      descriptionTextarea.value =
        selectedOption.getAttribute("data-description") || "";
      pointsInput.value = selectedOption.getAttribute("data-points") || 0;
    } else {
      descriptionTextarea.value = "";
      pointsInput.value = 0;
    }
  };

  // ───────────────────────────────────────────────────────────
  // ENHANCED SAVE FUNCTION WITH REAL-TIME SYNC
  // ───────────────────────────────────────────────────────────

  window.saveEditedPractice = async function () {
    if (
      currentEditingSubmissionId === null ||
      currentEditingCategoryId === null ||
      currentEditingPracticeId === null
    ) {
      showNotification("Invalid editing state", "error");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      showNotification("Please log in to edit practices", "error");
      return;
    }

    // Get selected values from the modal
    const newPracticeName = document.getElementById("editPracticeName").value;
    const newDescription = document.getElementById(
      "editPracticeDescription"
    ).value;
    const newPoints =
      parseInt(document.getElementById("editPracticePoints").value) || 0;
    const newCategoryDisplayName = document.getElementById(
      "editPracticeCategory"
    ).value;

    if (!newPracticeName || !newCategoryDisplayName) {
      showNotification("Please select a practice and category", "error");
      return;
    }

    // Show a loading state on the save button
    const saveButton = document.querySelector(
      '#editPracticeForm button[type="submit"]'
    );
    const originalButtonText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveButton.disabled = true;

    try {
      const submissionRef = db
        .collection("users")
        .doc(user.uid)
        .collection("practice_submissions")
        .doc(currentEditingSubmissionId);

      // Get the original category document to access the practice
      const oldCategoryRef = submissionRef
        .collection("categories")
        .doc(currentEditingCategoryId);
      const oldCategoryDoc = await oldCategoryRef.get();
      if (!oldCategoryDoc.exists) throw new Error("Lol");

      const oldCategoryData = oldCategoryDoc.data();
      const oldCategoryDisplayName = oldCategoryData.categoryDisplayName;
      let practicesInOldCategory = oldCategoryData.practices || [];
      const practiceToEdit = practicesInOldCategory[currentEditingPracticeId];

      // Check if the category has been changed
      const categoryHasChanged =
        oldCategoryDisplayName !== newCategoryDisplayName;

      // Use the original submission date to check for double points
      const submissionDate = new Date(currentViewingSubmission.date);
      const isDoublePoints = shouldDoublePoints(
        newCategoryDisplayName,
        submissionDate
      );

      // Create the updated practice object
      const updatedPractice = {
        ...practiceToEdit,
        name: newPracticeName,
        description: newDescription,
        points: newPoints,
        isDoublePoints: isDoublePoints,
        isEdited: true,
        lastModified: firebase.firestore.Timestamp.now(),
      };

      // --- LOGIC TO HANDLE CATEGORY CHANGE ---

      if (categoryHasChanged) {
        // 1. REMOVE practice from the old category
        practicesInOldCategory.splice(currentEditingPracticeId, 1);

        // Update or delete the old category document
        if (practicesInOldCategory.length === 0) {
          await oldCategoryRef.delete(); // Delete if it's now empty
        } else {
          const newTotalPoints = practicesInOldCategory.reduce(
            (sum, p) =>
              sum + (p.isDoublePoints ? (p.points || 0) * 2 : p.points || 0),
            0
          );
          await oldCategoryRef.update({
            practices: practicesInOldCategory,
            totalPoints: newTotalPoints,
            totalPractices: practicesInOldCategory.length,
            lastModified: firebase.firestore.Timestamp.now(),
          });
        }

        // 2. ADD practice to the new category
        let newCategoryRef;
        // Check if a document for the new category already exists for this day
        const newCategoryQuery = await submissionRef
          .collection("categories")
          .where("categoryDisplayName", "==", newCategoryDisplayName)
          .limit(1)
          .get();

        if (!newCategoryQuery.empty) {
          // It exists, so update it
          newCategoryRef = newCategoryQuery.docs[0].ref;
          await newCategoryRef.update({
            practices:
              firebase.firestore.FieldValue.arrayUnion(updatedPractice),
            totalPractices: firebase.firestore.FieldValue.increment(1),
            totalPoints: firebase.firestore.FieldValue.increment(
              isDoublePoints ? newPoints * 2 : newPoints
            ),
            lastModified: firebase.firestore.Timestamp.now(),
          });
        } else {
          // It doesn't exist, so create it
          newCategoryRef = submissionRef.collection("categories").doc(); // Create a new doc reference
          await newCategoryRef.set({
            categoryDisplayName: newCategoryDisplayName,
            category: newCategoryDisplayName.toLowerCase().replace(/\s+/g, "_"),
            practices: [updatedPractice],
            totalPractices: 1,
            totalPoints: isDoublePoints ? newPoints * 2 : newPoints,
            submittedAt: firebase.firestore.Timestamp.now(),
            lastModified: firebase.firestore.Timestamp.now(),
            isDeleted: false,
            submissionBasketId: oldCategoryData.submissionBasketId, // Reuse from original
          });
        }
      } else {
        // Category is the SAME, just update the practice in the existing document
        practicesInOldCategory[currentEditingPracticeId] = updatedPractice;
        const newTotalPoints = practicesInOldCategory.reduce(
          (sum, p) =>
            sum + (p.isDoublePoints ? (p.points || 0) * 2 : p.points || 0),
          0
        );
        await oldCategoryRef.update({
          practices: practicesInOldCategory,
          totalPoints: newTotalPoints,
          lastModified: firebase.firestore.Timestamp.now(),
        });
      }

      // --- RECALCULATE AND SYNC ALL TOTALS ---

      // Get previous total points for the day to calculate the difference
      const prevDailySubmissionDoc = await submissionRef.get();
      const prevDailyTotalPoints =
        prevDailySubmissionDoc.data().totalPoints || 0;

      // Recalculate all totals for the day based on the new state of its categories
      const {
        totalPoints: newDailyTotalPoints,
        totalPractices: newDailyTotalPractices,
        totalCategories: newDailyTotalCategories,
      } = await calculateDailyTotals(user.uid, currentEditingSubmissionId);

      // Update the daily submission metadata
      await submissionRef.update({
        totalCategories: newDailyTotalCategories,
        totalPractices: newDailyTotalPractices,
        totalPoints: newDailyTotalPoints,
        lastModified: firebase.firestore.Timestamp.now(),
      });

      // --- ADD THIS BLOCK TO SYNC WITH REALTIME DATABASE ---
      const realtimeTimestamp = firebase.database.ServerValue.TIMESTAMP;
      await realtimeDb
        .ref(
          `users/${user.uid}/practice_submissions/${currentEditingSubmissionId}/metadata`
        )
        .update({
          totalCategories: newDailyTotalCategories,
          totalPractices: newDailyTotalPractices,
          totalPoints: newDailyTotalPoints,
          lastModified: realtimeTimestamp,
        });
      // --- END OF ADDED BLOCK ---

      // Update the user's overall score by the difference
      const pointsDifference = newDailyTotalPoints - prevDailyTotalPoints;
      if (pointsDifference !== 0) {
        const userRootRef = db.collection("users").doc(user.uid);
        await userRootRef.update({
          totalUserScore:
            firebase.firestore.FieldValue.increment(pointsDifference),
        });
        // Also sync with Realtime DB if needed
        await realtimeDb
          .ref(`users/${user.uid}/totalUserScore`)
          .set(firebase.database.ServerValue.increment(pointsDifference));
      }

      // --- REFRESH THE ENTIRE UI ---
      // A full refresh is now safest because categories may have been added/deleted
      await refreshAllUIComponents(user.uid);

      showNotification("Practice updated successfully!", "success");
      closeEditPracticeModal();
      // Re-open the details modal to show the updated state
      setTimeout(() => viewSubmissionDetails(currentEditingSubmissionId), 200);
    } catch (error) {
      showNotification("Please Refresh Page");
    } finally {
      // Restore the save button's state
      saveButton.innerHTML = originalButtonText;
      saveButton.disabled = false;
    }
  };

  // Function to check if double points apply for a category on a specific date
  function shouldDoublePoints(category, date) {
    // Current time is Wednesday, July 16, 2025 at 12:06:02 PM SAST.
    // Fixed dates for double points based on current time context (2025 dates)
    const specialPointsPeriods = {
      Putting: [
        { start: new Date(2025, 6, 1), end: new Date(2025, 6, 6) }, // July 1-6, 2025
        { start: new Date(2025, 7, 11), end: new Date(2025, 7, 17) }, // Aug 11-17, 2025
      ],
      Chipping: [
        { start: new Date(2025, 6, 7), end: new Date(2025, 6, 13) }, // July 7-13, 2025
        { start: new Date(2025, 7, 18), end: new Date(2025, 7, 24) }, // Aug 18-24, 2025
      ],
      "Irons & Tee Shot": [
        { start: new Date(2025, 6, 14), end: new Date(2025, 6, 20) }, // July 14-20, 2025
        { start: new Date(2025, 7, 4), end: new Date(2025, 7, 10) }, // Aug 4-10, 2025
      ],
      "Tournament Prep": [
        { start: new Date(2025, 6, 21), end: new Date(2025, 6, 27) }, // July 21-27, 2025
        { start: new Date(2025, 8, 15), end: new Date(2025, 8, 23) }, // Sep 15-23, 2025
      ],
      Mental: [
        { start: new Date(2025, 6, 28), end: new Date(2025, 7, 3) }, // July 28 - Aug 3, 2025
        { start: new Date(2025, 8, 8), end: new Date(2025, 8, 14) }, // Sep 8-14, 2025
      ],
      Fitness: [
        { start: new Date(2025, 7, 25), end: new Date(2025, 7, 31) }, // Aug 25-31, 2025
      ],
    };

    if (!specialPointsPeriods[category]) {
      return false;
    }

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0); // Normalize to start of day

    return specialPointsPeriods[category].some((period) => {
      const startDate = new Date(period.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(period.end);
      endDate.setHours(23, 59, 59, 999); // Normalize to end of day

      return checkDate >= startDate && checkDate <= endDate;
    });
  }

  // ───────────────────────────────────────────────────────────
  // NEW: updateRootUserTotals (from submit-task.js)
  // ───────────────────────────────────────────────────────────
  async function updateRootUserTotals(
    userId,
    pointsDifference,
    practicesDifference,
    firestoreDb,
    realtimeDb
  ) {
    try {
      if (pointsDifference === 0 && practicesDifference === 0) {
        console.log(
          "No difference in points or practices, skipping root user totals update."
        );
        return;
      }

      console.log(
        `Updating root user totals for ${userId}: pointsDiff=${pointsDifference}, practicesDiff=${practicesDifference}`
      );

      const userFirestoreRef = firestoreDb.collection("users").doc(userId);
      const userRealtimeRef = realtimeDb.ref(`users/${userId}`);

      // Fetch current user totals from Realtime DB for accurate increment
      const currentRealtimeUserSnapshot = await userRealtimeRef.once("value");
      const currentRealtimeUserData = currentRealtimeUserSnapshot.val() || {
        totalUserScore: 0,
        totalUserPractices: 0,
      };

      const newTotalUserScore =
        (currentRealtimeUserData.totalUserScore || 0) + pointsDifference;
      const newTotalUserPractices =
        (currentRealtimeUserData.totalUserPractices || 0) + practicesDifference;

      // Update Firestore
      await userFirestoreRef.update({
        totalUserScore: newTotalUserScore, // Set directly based on recalculated value
        totalUserPractices: newTotalUserPractices, // Set directly
        lastModified: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Update Realtime Database
      await userRealtimeRef.update({
        totalUserScore: newTotalUserScore, // Set directly
        totalUserPractices: newTotalUserPractices, // Set directly
        lastModified: firebase.database.ServerValue.TIMESTAMP,
      });

      console.log(
        `Root user totals updated successfully. New Score: ${newTotalUserScore}, New Practices: ${newTotalUserPractices}`
      );
    } catch (error) {
      console.error("Error updating root user totals:", error);
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────
  // ENHANCED SUBMISSION DETAILS MODAL
  // ───────────────────────────────────────────────────────────

  window.viewSubmissionDetails = function (submissionId) {
    // Removed dailySubmissionId as it's the same as submissionId
    let submission = allSubmissions.find((s) => s.id === submissionId);

    if (!submission) {
      showNotification("Fetching Changes...", "warning");
      // If not found locally, try to re-fetch and then show
      auth.currentUser &&
        fetchUserSubmissions(auth.currentUser.uid).then(() => {
          submission = allSubmissions.find((s) => s.id === submissionId);
          if (submission) {
            currentViewingSubmission = submission;
            showSubmissionDetailsModal(submission);
          } else {
            showNotification("Fede, Refresh the page to view changes", "error");
          }
        });
      return;
    }

    currentViewingSubmission = submission;
    showSubmissionDetailsModal(submission);
  };

  function showSubmissionDetailsModal(submission) {
    // Create modal if it doesn't exist
    let modal = document.getElementById("submissionDetailsModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "submissionDetailsModal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    const date = new Date(submission.date);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Enhanced practice display with real-time editing and DELETE capabilities
    let categoriesHTML = "";
    submission.categories.forEach((category) => {
      let practicesHTML = "";
      category.practices.forEach((practice, index) => {
        // Handle both old and new data structures
        const practiceName =
          practice.name || practice.practiceDescription || "Unnamed Practice";
        const practiceDesc =
          practice.description ||
          practice.originalPracticeData?.description ||
          practice.practiceDescription ||
          "No description"; // Prefer description from original data if available
        const practicePoints = practice.isDoublePoints
          ? (practice.points || 0) * 2
          : practice.points || 0;
        const originalPoints = practice.points || 0; // The base points before doubling
        const isEditedIndicator = practice.isEdited
          ? '<span class="edited-indicator" title="This practice was manually edited."><i class="fas fa-pencil-alt"></i></span>'
          : "";
        const isDoublePointsIndicator = practice.isDoublePoints
          ? '<span class="double-points-indicator" title="Double Points Applied!"><i class="fas fa-star"></i></span>'
          : "";

        practicesHTML += `
        <div class="practice-item" data-practice-index="${index}" data-practice-id="${
          practice.id || ""
        }">
          <div class="practice-info">
            <h5>${practiceName} ${isEditedIndicator} ${isDoublePointsIndicator}</h5>
            <p>${practiceDesc}</p>
            <div class="practice-meta">
              <span class="points-display">Points: ${practicePoints}</span>
              ${
                practice.addedAt
                  ? `<span>Added: ${new Date(
                      practice.addedAt
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="practice-actions">
            <button class="edit-practice-btn" onclick="editPractice('${
              submission.id
            }', '${category.id}', ${index})" title="Edit Practice">
              <i class="fas fa-edit"></i>
            </button>
            <button class="delete-practice-btn" onclick="confirmDeletePractice('${
              submission.id
            }', '${category.id}', ${index}, '${practiceName}', '${
          submission.date
        }', ${originalPoints})" title="Delete Practice">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      `;
      });

      categoriesHTML += `
      <div class="category-section" data-category-id="${category.id}">
        <div class="category-header">
          <h4>${category.name}</h4>
          <div class="category-stats">
            <span class="practices-count">${
              category.totalPractices
            } practices</span>
            <span class="points-count">${category.totalPoints} points</span>
          </div>
          <div class="category-actions">
              <button class="delete-category-btn" onclick="confirmDeleteCategory('${
                submission.id
              }', '${category.id}', '${category.name}', '${
        submission.date
      }')" title="Delete Category"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        <div class="practices-list">
          ${
            practicesHTML ||
            '<p class="no-practices-message">No practices in this category.</p>'
          }
        </div>
      </div>
    `;
    });

    modal.innerHTML = `
    <div class="modal-container large-modal">
      <div class="modal-header">
        <h3>Practice Session - ${formattedDate}</h3>
        <button class="modal-close" onclick="closeSubmissionDetailsModal()" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="submission-overview">
          <div class="overview-stats">
            <div class="stat-item">
              <span class="stat-label">Categories</span>
              <span class="stat-value categories-total">${
                submission.totalCategories
              }</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Practices</span>
              <span class="stat-value practices-total">${
                submission.totalPractices
              }</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Points</span>
              <span class="stat-value points-total">${
                submission.totalPoints
              }</span>
            </div>
          </div>
        </div>

        <div class="categories-container">
          ${
            categoriesHTML ||
            '<div class="empty-state-message">No categories found for this submission.</div>'
          }
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeSubmissionDetailsModal()">
          <i class="fas fa-arrow-left"></i> Back
        </button>
        <button class="btn-danger" onclick="confirmDeleteDailySubmission('${
          submission.id
        }', '${submission.date}', ${submission.totalPoints || 0}, ${
      submission.totalPractices || 0
    })">
            <i class="fas fa-trash-alt"></i> Delete Day's Session
        </button>
      </div>
    </div>
  `;

    // Set base z-index for details modal
    modal.style.zIndex = "1000";
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }

  window.closeSubmissionDetailsModal = function () {
    const modal = document.getElementById("submissionDetailsModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.style.zIndex = ""; // Reset z-index
    }
    currentViewingSubmission = null;
  };

  // ───────────────────────────────────────────────────────────
  // ENHANCED TIMELINE POPULATION WITH SYNC SUPPORT
  // ───────────────────────────────────────────────────────────

  function populateSubmissionsTimeline(
    data,
    filterType = "all",
    startDate = null,
    endDate = null
  ) {
    const container = document.getElementById("timelineContainer");
    if (!container) return;

    container.innerHTML = "";

    // Filter data based on parameters, also filtering out soft-deleted daily submissions
    let filteredData = data.filter(
      (submission) =>
        submission.isDeleted !== true && submission.isActive !== false
    );

    if (filterType !== "all") {
      filteredData = filteredData.filter((submission) =>
        submission.categories.some(
          (cat) => cat.name === filterType && cat.isDeleted !== true
        )
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filteredData = filteredData.filter((submission) => {
        const submissionDate = new Date(submission.date);
        submissionDate.setHours(0, 0, 0, 0);
        return submissionDate >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter((submission) => {
        const submissionDate = new Date(submission.date);
        return submissionDate <= end;
      });
    }

    // Sort by date (newest first)
    filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredData.length === 0) {
      container.innerHTML = `
      <div class="empty-state" style="padding: 20px; color: #bdbdbd;">
        <p>No practice submissions found for the selected filters.</p>
      </div>
    `;
      return;
    }

    // Create timeline items for submissions
    filteredData.forEach((submission) => {
      // Ensure the submission itself hasn't been logically deleted or set inactive
      if (submission.isDeleted === true || submission.isActive === false) {
        return;
      }

      const date = new Date(submission.date);
      const formattedDate = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Format submission time
      let timeInfo = "";
      if (submission.submittedAt) {
        const submittedTime = submission.submittedAt.toDate
          ? submission.submittedAt.toDate()
          : new Date(submission.submittedAt);
        timeInfo = ` at ${submittedTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }

      const timelineItem = document.createElement("div");
      timelineItem.className = "timeline-item submission-item";
      timelineItem.setAttribute("data-submission-id", submission.id);
      if (submission.dailySubmissionId) {
        timelineItem.setAttribute(
          "data-daily-submission-id",
          submission.dailySubmissionId
        );
      }

      timelineItem.innerHTML = `
      <div class="timeline-date">${formattedDate}${timeInfo}</div>
      <div class="timeline-content">
        <div class="submission-header">
          <h3>Practice Session</h3>
          <div class="submission-actions">
            <button class="view-details-btn" onclick="viewSubmissionDetails('${
              submission.id
            }')">
              <i class="fas fa-eye"></i> View Details
            </button>
          </div>
        </div>
        <div class="submission-summary">
          <p><strong>Categories:</strong> ${
            submission.categorySummary || "No categories"
          }</p>
          <div class="submission-stats">
            <span><i class="fas fa-list"></i> ${
              submission.totalCategories || 0
            } Categories</span>
            <span><i class="fas fa-dumbbell"></i> ${
              submission.totalPractices || 0
            } Practices</span>
            <span><i class="fas fa-star"></i> ${
              submission.totalPoints || 0
            } Points</span>
          </div>
        </div>
      </div>
    `;

      container.appendChild(timelineItem);
    });

    // If after filtering, no items remain, show empty state message
    if (container.children.length === 0) {
      container.innerHTML = `
          <div class="empty-state" style="padding: 20px; color: #bdbdbd;">
              <p>No practice submissions found for the selected filters.</p>
          </div>
      `;
    }

    console.log(`Timeline populated with ${filteredData.length} submissions`);
  }

  // ───────────────────────────────────────────────────────────
  // FILTERING AND SEARCH FUNCTIONALITY
  // ───────────────────────────────────────────────────────────

  function populateCategoryFilter(data) {
    const filterSelect = document.getElementById("practiceFilter");
    if (!filterSelect) return;

    // Clear existing options except "All Practices"
    filterSelect.innerHTML = '<option value="all">All Practices</option>';

    const uniqueCategories = new Set();
    data.forEach((submission) => {
      submission.categories.forEach((category) => {
        if (category.isDeleted !== true) {
          uniqueCategories.add(category.name);
        }
      });
    });

    Array.from(uniqueCategories)
      .sort()
      .forEach((categoryName) => {
        const option = document.createElement("option");
        option.value = categoryName;
        option.textContent = categoryName;
        filterSelect.appendChild(option);
      });

    filterSelect.addEventListener("change", applyFilters);
  }

  function setupDateRangeFilters() {
    const startDateInput = document.getElementById("dateRangeStart");
    const endDateInput = document.getElementById("dateRangeEnd");

    if (startDateInput) startDateInput.addEventListener("change", applyFilters);
    if (endDateInput) endDateInput.addEventListener("change", applyFilters);
  }

  function applyFilters() {
    const filterSelect = document.getElementById("practiceFilter");
    const startDateInput = document.getElementById("dateRangeStart");
    const endDateInput = document.getElementById("dateRangeEnd");

    const selectedCategory = filterSelect ? filterSelect.value : "all";
    const startDate = startDateInput ? startDateInput.value : null;
    const endDate = endDateInput ? endDateInput.value : null;

    populateSubmissionsTimeline(
      allSubmissions,
      selectedCategory,
      startDate,
      endDate
    );
  }

  // ───────────────────────────────────────────────────────────
  // NEW DELETE FUNCTIONALITY
  // ───────────────────────────────────────────────────────────

  // 1. Confirmation Modal setup (for delete actions)
  function setupConfirmationModal() {
    let modal = document.getElementById("confirmationModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "confirmationModal";
      modal.className = "modal-overlay hidden";
      document.body.appendChild(modal);
    }
    // Content is dynamically loaded by confirmDelete functions
  }
  setupConfirmationModal(); // Call this once on DOMContentLoaded

  window.showConfirmationModal = function (
    title,
    message,
    onConfirmCallback,
    confirmButtonText = "Confirm",
    confirmButtonClass = "btn-danger"
  ) {
    const modal = document.getElementById("confirmationModal");
    const modalTitle = document.getElementById("confirmationTitle");
    const modalMessage = document.getElementById("confirmationMessage");
    const confirmActionBtn = document.getElementById("confirmActionBtn");

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmActionBtn.textContent = confirmButtonText;
    confirmActionBtn.className = confirmButtonClass; // Set class for styling

    // Remove existing listener before adding new one
    confirmActionBtn.onclick = null;
    confirmActionBtn.onclick = async () => {
      // Show loading state on button
      confirmActionBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Processing...';
      confirmActionBtn.disabled = true;

      try {
        await onConfirmCallback(); // Execute the actual delete logic
        window.closeConfirmationModal(); // Close modal on success
      } catch (error) {
        console.error("Error during confirmation action:", error);
        showNotification("Operation failed: " + error.message, "error");
        // Re-enable button and reset text on error
        confirmActionBtn.innerHTML = confirmButtonText;
        confirmActionBtn.disabled = false;
      }
    };

    modal.classList.remove("hidden");
    modal.style.display = "flex"; // Ensure flex for centering
  };

  window.closeConfirmationModal = function () {
    const modal = document.getElementById("confirmationModal");
    modal.classList.add("hidden");
    modal.style.display = "none";
  };

  // 2. Confirmation functions for different delete levels
  window.confirmDeletePractice = function (
    submissionId,
    categoryId,
    practiceIndex,
    practiceName,
    submissionDate,
    originalPoints
  ) {
    const title = "Delete Individual Practice?";
    const message = `Are you sure you want to delete "${practiceName}" (${originalPoints} pts) from your session on ${new Date(
      submissionDate
    ).toLocaleDateString()}? This action cannot be undone.`;
    showConfirmationModal(title, message, async () => {
      await deletePracticeItem(
        auth.currentUser.uid,
        submissionId,
        categoryId,
        practiceIndex,
        originalPoints,
        submissionDate
      );
      showNotification(`"${practiceName}" deleted.`, "success");
      // Refresh the submission details modal if it's open, otherwise refresh timeline
      if (
        currentViewingSubmission &&
        currentViewingSubmission.id === submissionId
      ) {
        window.viewSubmissionDetails(submissionId);
      } else {
        refreshAllUIComponents(auth.currentUser.uid); // Full refresh to ensure everything is in sync
      }
    });
  };

  window.confirmDeleteCategory = function (
    submissionId,
    categoryId,
    categoryName,
    submissionDate
  ) {
    const title = "Delete Category Submission?";
    const message = `Are you sure you want to delete the entire "${categoryName}" category from your session on ${new Date(
      submissionDate
    ).toLocaleDateString()}? This will remove all practices within it. This action cannot be undone.`;
    showConfirmationModal(title, message, async () => {
      await deleteCategorySubmission(
        auth.currentUser.uid,
        submissionId,
        categoryId,
        submissionDate
      );
      showNotification(`Category "${categoryName}" deleted.`, "success");
      if (
        currentViewingSubmission &&
        currentViewingSubmission.id === submissionId
      ) {
        window.viewSubmissionDetails(submissionId);
      } else {
        refreshAllUIComponents(auth.currentUser.uid);
      }
    });
  };

  window.confirmDeleteDailySubmission = function (
    submissionId,
    submissionDate,
    totalPoints,
    totalPractices
  ) {
    const title = "Delete Entire Daily Session?";
    const message = `Are you sure you want to delete your entire practice session from ${new Date(
      submissionDate
    ).toLocaleDateString()} (Total Points: ${totalPoints}, Total Practices: ${totalPractices})? This will remove all associated data. This action cannot be undone.`;
    showConfirmationModal(title, message, async () => {
      await deleteDailySubmission(
        auth.currentUser.uid,
        submissionId,
        submissionDate,
        totalPoints,
        totalPractices
      );
      showNotification(
        `Daily session from ${new Date(
          submissionDate
        ).toLocaleDateString()} deleted.`,
        "success"
      );
      closeSubmissionDetailsModal(); // Close details modal after deleting the entire day
      refreshAllUIComponents(auth.currentUser.uid);
    });
  };

  // 3. Core Delete Functions (implementing actual database operations)

  /**
   * Deletes a specific practice item from a category and updates all relevant totals.
   * @param {string} userId
   * @param {string} dailySubmissionId The ID of the daily submission document (Firestore doc ID)
   * @param {string} categoryDocId The ID of the category document within the daily submission (Firestore doc ID)
   * @param {number} practiceIndex The index of the practice item within the category's 'practices' array
   * @param {number} originalPoints The points of the practice BEFORE any double points calculation
   * @param {string} submissionDate The date string of the daily submission (YYYY-MM-DD)
   */
  async function deletePracticeItem(
    userId,
    dailySubmissionId,
    categoryDocId,
    practiceIndex,
    originalPoints,
    submissionDate
  ) {
    const firestoreTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    const realtimeTimestamp = firebase.database.ServerValue.TIMESTAMP;

    try {
      const submissionRef = db
        .collection("users")
        .doc(userId)
        .collection("practice_submissions")
        .doc(dailySubmissionId);
      const categoryRef = submissionRef
        .collection("categories")
        .doc(categoryDocId);

      // 1. Get the current category document
      const categoryDoc = await categoryRef.get();
      if (!categoryDoc.exists) {
        console.warn(
          "Category document not found for deletion:",
          categoryDocId
        );
        return; // Already deleted or invalid, nothing to do
      }

      const categoryData = categoryDoc.data();
      let practices = categoryData.practices || [];

      // Determine if double points apply for this category and date
      const isDoublePointsPeriod = shouldDoublePoints(
        categoryData.categoryDisplayName,
        new Date(submissionDate)
      );

      // Calculate points of the practice being deleted (considering double points if active)
      let pointsToDelete = originalPoints;
      if (isDoublePointsPeriod) {
        pointsToDelete *= 2;
      }

      // Identify the practice name for daily completions update
      const practiceName = practices[practiceIndex]?.name;
      const isAllowMultiple = practicesData[
        categoryData.categoryDisplayName
      ]?.find((p) => p.name === practiceName)?.allowMultiple;

      // 2. Remove the specific practice from the array
      const removedPractices = practices.splice(practiceIndex, 1);
      if (removedPractices.length === 0) {
        console.warn(
          "Practice not found at index, already removed or invalid operation."
        );
        return;
      }

      // 3. Recalculate category totals
      const newCategoryTotalPoints = practices.reduce(
        (sum, p) =>
          sum + (p.isDoublePoints ? (p.points || 0) * 2 : p.points || 0),
        0
      );
      const newCategoryTotalPractices = practices.length;

      const firestoreBatch = db.batch();
      const realtimePromises = [];

      // 4. Update category document in Firestore and Realtime DB
      if (newCategoryTotalPractices === 0) {
        // Option 1: Soft delete category (safer)
        firestoreBatch.update(categoryRef, {
          isDeleted: true,
          totalPoints: 0,
          totalPractices: 0,
          deletedAt: firestoreTimestamp,
          lastModified: firestoreTimestamp,
        });
        realtimePromises.push(
          realtimeDb
            .ref(
              `users/${userId}/practice_submissions/${dailySubmissionId}/categories/${categoryDocId}`
            )
            .update({
              isDeleted: true,
              totalPoints: 0,
              totalPractices: 0,
              deletedAt: realtimeTimestamp,
              lastModified: realtimeTimestamp,
            })
        );
        console.log(`Category ${categoryDocId} soft-deleted as it's empty.`);
      } else {
        firestoreBatch.update(categoryRef, {
          practices: practices,
          totalPoints: newCategoryTotalPoints,
          totalPractices: newCategoryTotalPractices,
          lastModified: firestoreTimestamp,
        });
        realtimePromises.push(
          realtimeDb
            .ref(
              `users/${userId}/practice_submissions/${dailySubmissionId}/categories/${categoryDocId}`
            )
            .update({
              practices: practices,
              totalPoints: newCategoryTotalPoints,
              totalPractices: newCategoryTotalPractices,
              lastModified: realtimeTimestamp,
            })
        );
        console.log(`Category ${categoryDocId} updated.`);
      }

      // 5. Recalculate and update daily submission metadata
      await firestoreBatch.commit(); // Commit category updates first
      await Promise.all(realtimePromises); // Wait for realtime updates

      // Now calculate new daily totals based on updated categories
      const {
        totalPoints: newDailyTotalPoints,
        totalPractices: newDailyTotalPractices,
        totalCategories: newDailyTotalCategories,
      } = await calculateDailyTotals(userId, dailySubmissionId);

      // Get the previous daily total from the metadata document before updating it
      const prevDailySubmissionDoc = await submissionRef.get();
      const prevDailyTotalPoints = prevDailySubmissionDoc.exists
        ? prevDailySubmissionDoc.data().totalPoints || 0
        : 0;
      const prevDailyTotalPractices = prevDailySubmissionDoc.exists
        ? prevDailySubmissionDoc.data().totalPractices || 0
        : 0;

      // Update daily submission metadata in Firestore
      await submissionRef.update({
        totalCategories: newDailyTotalCategories,
        totalPractices: newDailyTotalPractices,
        totalPoints: newDailyTotalPoints,
        lastModified: firestoreTimestamp,
      });

      // Update daily submission metadata in Realtime Database
      await realtimeDb
        .ref(
          `users/${userId}/practice_submissions/${dailySubmissionId}/metadata`
        )
        .update({
          totalCategories: newDailyTotalCategories,
          totalPractices: newDailyTotalPractices,
          totalPoints: newDailyTotalPoints,
          lastModified: realtimeTimestamp,
        });

      // 6. Update user's root totals
      // The difference to apply to the root user totals is based on the change in daily totals
      const pointsDifferenceForRoot =
        newDailyTotalPoints - prevDailyTotalPoints;
      const practicesDifferenceForRoot =
        newDailyTotalPractices - prevDailyTotalPractices;

      await updateRootUserTotals(
        userId,
        pointsDifferenceForRoot,
        practicesDifferenceForRoot,
        db,
        realtimeDb
      );

      // 7. Remove from daily_completions for single-submission practices
      if (practiceName && !isAllowMultiple) {
        const todayDateString = submissionDate; // Use the submission date for lookup
        const dailyCompletionsRef = db
          .collection("users")
          .doc(userId)
          .collection("daily_completions")
          .doc(todayDateString);
        await dailyCompletionsRef.update({
          completed_practices:
            firebase.firestore.FieldValue.arrayRemove(practiceName),
        });
        console.log(
          `Removed "${practiceName}" from daily completions for ${todayDateString}`
        );
      }

      console.log(
        "Practice item deleted successfully and all totals recalculated!"
      );
      // Locally update allSubmissions and trigger UI refresh
      await refreshAllUIComponents(userId);
    } catch (error) {
      console.error("Error deleting practice item:", error);
      throw error; // Re-throw to be caught by the modal's error handler
    }
  }

  /**
   * Deletes an entire category submission and updates all relevant totals.
   * @param {string} userId
   * @param {string} dailySubmissionId The ID of the daily submission document
   * @param {string} categoryDocId The ID of the category document to delete
   * @param {string} submissionDate The date string of the daily submission (YYYY-MM-DD)
   */
  async function deleteCategorySubmission(
    userId,
    dailySubmissionId,
    categoryDocId,
    submissionDate
  ) {
    const firestoreTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    const realtimeTimestamp = firebase.database.ServerValue.TIMESTAMP;

    try {
      const submissionRef = db
        .collection("users")
        .doc(userId)
        .collection("practice_submissions")
        .doc(dailySubmissionId);
      const categoryRef = submissionRef
        .collection("categories")
        .doc(categoryDocId);

      // 1. Get the category document to know its points/practices
      const categoryDoc = await categoryRef.get();
      if (!categoryDoc.exists) {
        console.warn(
          "Category document not found for deletion:",
          categoryDocId
        );
        return;
      }
      const categoryData = categoryDoc.data();
      const practicesInDeletedCategory = categoryData.practices || [];

      // 2. Soft delete the category
      await categoryRef.update({
        isDeleted: true,
        totalPoints: 0, // Reset points to 0 as it's deleted
        totalPractices: 0, // Reset practices to 0
        deletedAt: firestoreTimestamp,
        lastModified: firestoreTimestamp,
      });
      await realtimeDb
        .ref(
          `users/${userId}/practice_submissions/${dailySubmissionId}/categories/${categoryDocId}`
        )
        .update({
          isDeleted: true,
          totalPoints: 0,
          totalPractices: 0,
          deletedAt: realtimeTimestamp,
          lastModified: realtimeTimestamp,
        });
      console.log(`Category ${categoryDocId} soft-deleted.`);

      // 3. Recalculate and update daily submission metadata
      const prevDailySubmissionDoc = await submissionRef.get();
      const prevDailyTotalPoints = prevDailySubmissionDoc.exists
        ? prevDailySubmissionDoc.data().totalPoints || 0
        : 0;
      const prevDailyTotalPractices = prevDailySubmissionDoc.exists
        ? prevDailySubmissionDoc.data().totalPractices || 0
        : 0;

      const {
        totalPoints: newDailyTotalPoints,
        totalPractices: newDailyTotalPractices,
        totalCategories: newDailyTotalCategories,
      } = await calculateDailyTotals(userId, dailySubmissionId);

      await submissionRef.update({
        totalCategories: newDailyTotalCategories,
        totalPractices: newDailyTotalPractices,
        totalPoints: newDailyTotalPoints,
        lastModified: firestoreTimestamp,
      });
      await realtimeDb
        .ref(
          `users/${userId}/practice_submissions/${dailySubmissionId}/metadata`
        )
        .update({
          totalCategories: newDailyTotalCategories,
          totalPractices: newDailyTotalPractices,
          totalPoints: newDailyTotalPoints,
          lastModified: realtimeTimestamp,
        });
      // 4. Update user's root totals
      const pointsDifferenceForRoot =
        newDailyTotalPoints - prevDailyTotalPoints;
      const practicesDifferenceForRoot =
        newDailyTotalPractices - prevDailyTotalPractices;
      await updateRootUserTotals(
        userId,
        pointsDifferenceForRoot,
        practicesDifferenceForRoot,
        db,
        realtimeDb
      );

      // 5. Remove associated practices from daily_completions
      const todayDateString = submissionDate; // Use the submission date for lookup
      const dailyCompletionsRef = db
        .collection("users")
        .doc(userId)
        .collection("daily_completions")
        .doc(todayDateString);

      const singleSubmissionPractices = practicesInDeletedCategory.filter(
        (p) => !p.originalPracticeData?.allowMultiple
      ); // Filter based on original data
      if (singleSubmissionPractices.length > 0) {
        await dailyCompletionsRef.update({
          completed_practices: firebase.firestore.FieldValue.arrayRemove(
            ...singleSubmissionPractices.map((p) => p.name)
          ),
        });
        console.log(
          `Removed associated single-entry practices from daily completions for ${todayDateString}`
        );
      }

      console.log(
        "Category submission deleted successfully and all totals recalculated!"
      );
      await refreshAllUIComponents(userId);
    } catch (error) {
      console.error("Error deleting category submission:", error);
      throw error;
    }
  }

  /**
   * Deletes an entire daily submission document (metadata + all categories) and updates user totals.
   * @param {string} userId
   * @param {string} dailySubmissionId The ID of the daily submission document to delete
   * @param {string} submissionDate The date string of the daily submission (YYYY-MM-DD)
   * @param {number} totalPointsToDelete The total points of the daily submission being deleted
   * @param {number} totalPracticesToDelete The total practices of the daily submission being deleted
   */
  async function deleteDailySubmission(
    userId,
    dailySubmissionId,
    submissionDate,
    totalPointsToDelete,
    totalPracticesToDelete
  ) {
    const firestoreTimestamp = firebase.firestore.FieldValue.serverTimestamp();
    const realtimeTimestamp = firebase.database.ServerValue.TIMESTAMP;

    try {
      const submissionRef = db
        .collection("users")
        .doc(userId)
        .collection("practice_submissions")
        .doc(dailySubmissionId);

      // 1. Get all category documents associated with this daily submission
      const categoriesSnapshot = await submissionRef
        .collection("categories")
        .get();
      const categoryBatch = db.batch(); // Use a separate batch for categories
      const realtimeCategoryPromises = [];
      const practicesToRemoveFromDailyCompletions = [];

      categoriesSnapshot.forEach((catDoc) => {
        const categoryData = catDoc.data();
        if (categoryData.isDeleted !== true) {
          // Only process active categories
          // Soft delete each category
          categoryBatch.update(catDoc.ref, {
            isDeleted: true,
            totalPoints: 0,
            totalPractices: 0,
            deletedAt: firestoreTimestamp,
            lastModified: firestoreTimestamp,
          });
          realtimeCategoryPromises.push(
            realtimeDb.ref(catDoc.ref.path).update({
              isDeleted: true,
              totalPoints: 0,
              totalPractices: 0,
              deletedAt: realtimeTimestamp,
              lastModified: realtimeTimestamp,
            })
          );

          // Collect single-entry practices for daily_completions update
          (categoryData.practices || []).forEach((p) => {
            const originalPracticeDef = practicesData[
              categoryData.categoryDisplayName
            ]?.find((pd) => pd.name === p.name);
            if (originalPracticeDef && !originalPracticeDef.allowMultiple) {
              practicesToRemoveFromDailyCompletions.push(p.name);
            }
          });
        }
      });

      await categoryBatch.commit();
      await Promise.all(realtimeCategoryPromises);
      console.log(
        `All categories for daily submission ${dailySubmissionId} soft-deleted.`
      );

      // 2. Soft delete the daily submission metadata document itself
      await submissionRef.update({
        isDeleted: true,
        totalPoints: 0,
        totalPractices: 0,
        totalCategories: 0,
        deletedAt: firestoreTimestamp,
        lastModified: firestoreTimestamp,
        isActive: false, // Also mark as inactive for dashboard display
      });
      await realtimeDb
        .ref(`users/${userId}/practice_submissions/${dailySubmissionId}`)
        .update({
          isDeleted: true,
          totalPoints: 0,
          totalPractices: 0,
          totalCategories: 0,
          deletedAt: realtimeTimestamp,
          lastModified: realtimeTimestamp,
          isActive: false,
        });
      console.log(`Daily submission ${dailySubmissionId} soft-deleted.`);

      // 3. Update user's root totals (subtract the entire session's points and practices)
      await updateRootUserTotals(
        userId,
        -totalPointsToDelete,
        -totalPracticesToDelete,
        db,
        realtimeDb
      );

      // 4. Remove associated practices from daily_completions
      if (practicesToRemoveFromDailyCompletions.length > 0) {
        const dailyCompletionsRef = db
          .collection("users")
          .doc(userId)
          .collection("daily_completions")
          .doc(submissionDate);
        await dailyCompletionsRef.update({
          completed_practices: firebase.firestore.FieldValue.arrayRemove(
            ...practicesToRemoveFromDailyCompletions
          ),
        });
        console.log(
          `Removed associated single-entry practices from daily completions for ${submissionDate}`
        );
      }

      console.log(
        "Daily submission deleted successfully and all totals recalculated!"
      );
      await refreshAllUIComponents(userId);
    } catch (error) {
      console.error("Error deleting daily submission:", error);
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 10) EXPORT FUNCTIONALITY (COMPLETED)
  // ───────────────────────────────────────────────────────────
  function setupExportButtons(data) {
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    const printHistoryBtn = document.getElementById("printHistoryBtn");

    exportCsvBtn.addEventListener("click", function () {
      showExportModal(data);
    });

    printHistoryBtn.addEventListener("click", function () {
      showPrintPreview(data);
    });
  }

  // Show Export Modal with options
  function showExportModal(data) {
    let modal = document.getElementById("exportModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "exportModal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-container">
          <div class="modal-header">
            <h3>Export Practice History</h3>
            <button class="modal-close" onclick="closeExportModal()" aria-label="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body">
            <div class="export-options">
              <div class="export-option">
                <h4>Export Format</h4>
                <div class="radio-group">
                  <label>
                    <input type="radio" name="exportFormat" value="csv" checked>
                    <span class="radio-custom"></span>
                    CSV (Excel Compatible)
                  </label>
                  <label>
                    <input type="radio" name="exportFormat" value="json">
                    <span class="radio-custom"></span>
                    JSON (Data Format)
                  </label>
                </div>
              </div>

              <div class="export-option">
                <h4>Date Range</h4>
                <div class="date-range-group">
                  <label>From: <input type="date" id="exportStartDate"></label>
                  <label>To: <input type="date" id="exportEndDate"></label>
                </div>
              </div>

              <div class="export-option">
                <h4>Include Details</h4>
                <div class="checkbox-group">
                  <label>
                    <input type="checkbox" id="includeCategories" checked>
                    <span class="checkbox-custom"></span>
                    Category Details
                  </label>
                  <label>
                    <input type="checkbox" id="includePractices" checked>
                    <span class="checkbox-custom"></span>
                    Individual Practices
                  </label>
                  <label>
                    <input type="checkbox" id="includeStats" checked>
                    <span class="checkbox-custom"></span>
                    Statistics
                  </label>
                </div>
              </div>
            </div>

            <div class="export-preview">
              <h4>Export Preview</h4>
              <div class="preview-stats" id="exportPreviewStats">
                <span>Total Records: ${data.length}</span>
                <span>Date Range: All Time</span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" onclick="closeExportModal()">
              <i class="fas fa-times"></i> Cancel
            </button>
            <button class="btn-primary" onclick="executeExport()">
              <i class="fas fa-download"></i> Export Data
            </button>
          </div>
        </div>
      `;

    // Set date range defaults
    if (data.length > 0) {
      const activeData = data.filter(
        (s) => s.isDeleted !== true && s.isActive !== false
      ); // Only export active data
      const dates = activeData.map((s) => s.date).sort();
      if (dates.length > 0) {
        document.getElementById("exportStartDate").value = dates[0];
        document.getElementById("exportEndDate").value =
          dates[dates.length - 1];
      }
    }

    // Add event listeners for preview updates
    modal.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => updateExportPreview(data));
    });

    modal.classList.remove("hidden");
    modal.style.display = "flex";
    updateExportPreview(data);
  }

  function updateExportPreview(data) {
    const startDate = document.getElementById("exportStartDate")?.value;
    const endDate = document.getElementById("exportEndDate")?.value;

    let filteredData = data.filter(
      (s) => s.isDeleted !== true && s.isActive !== false
    ); // Always filter out deleted/inactive

    if (startDate) {
      filteredData = filteredData.filter((s) => s.date >= startDate);
    }
    if (endDate) {
      filteredData = filteredData.filter((s) => s.date <= endDate);
    }

    const previewStats = document.getElementById("exportPreviewStats");
    if (previewStats) {
      const dateRangeText =
        startDate && endDate
          ? `${new Date(startDate).toLocaleDateString()} - ${new Date(
              endDate
            ).toLocaleDateString()}`
          : "All Time";

      previewStats.innerHTML = `
          <span>Total Records: ${filteredData.length}</span>
          <span>Date Range: ${dateRangeText}</span>
          <span>Total Practices: ${filteredData.reduce(
            (sum, s) => sum + s.totalPractices,
            0
          )}</span>
        `;
    }
  }

  window.closeExportModal = function () {
    const modal = document.getElementById("exportModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  };

  window.executeExport = function () {
    const format = document.querySelector(
      'input[name="exportFormat"]:checked'
    ).value;
    const startDate = document.getElementById("exportStartDate").value;
    const endDate = document.getElementById("exportEndDate").value;
    const includeCategories =
      document.getElementById("includeCategories").checked;
    const includePractices =
      document.getElementById("includePractices").checked;
    const includeStats = document.getElementById("includeStats").checked;

    // Filter data by date range and active status
    let exportData = allSubmissions.filter(
      (s) => s.isDeleted !== true && s.isActive !== false
    );
    if (startDate) {
      exportData = exportData.filter((s) => s.date >= startDate);
    }
    if (endDate) {
      exportData = exportData.filter((s) => s.date <= endDate);
    }

    if (format === "csv") {
      const csvContent = convertToCSV(
        exportData,
        includeCategories,
        includePractices,
        includeStats
      );
      downloadFile(csvContent, "practice-history.csv", "text/csv");
    } else if (format === "json") {
      const jsonContent = convertToJSON(
        exportData,
        includeCategories,
        includePractices,
        includeStats
      );
      downloadFile(jsonContent, "practice-history.json", "application/json");
    }

    closeExportModal();
    showNotification("Export completed successfully!", "success");
  };

  function convertToCSV(
    data,
    includeCategories,
    includePractices,
    includeStats
  ) {
    const headers = [
      "Date",
      "Total Categories",
      "Total Practices",
      "Total Points",
    ];

    if (includeCategories) {
      headers.push("Categories Summary"); // Changed for clarity
    }

    if (includePractices) {
      headers.push("Individual Practices"); // Changed for clarity
    }

    if (includeStats) {
      headers.push("Submitted At"); // Changed for clarity
    }

    const rows = data.map((submission) => {
      const row = [
        submission.date,
        submission.totalCategories,
        submission.totalPractices,
        submission.totalPoints,
      ];

      if (includeCategories) {
        row.push(
          submission.categories
            .filter((c) => c.isDeleted !== true)
            .map(
              (cat) =>
                `${cat.name} (${cat.totalPractices} practices, ${cat.totalPoints} pts)`
            )
            .join("; ")
        );
      }

      if (includePractices) {
        const practiceDetails = submission.categories
          .filter((c) => c.isDeleted !== true)
          .map(
            (cat) =>
              `${cat.name}: ${cat.practices
                .map(
                  (p) =>
                    `${p.name} (${
                      p.isDoublePoints ? (p.points || 0) * 2 : p.points || 0
                    } pts)`
                )
                .join(", ")}`
          )
          .join(" | ");
        row.push(practiceDetails);
      }

      if (includeStats) {
        row.push(
          submission.submittedAt && submission.submittedAt.toDate
            ? submission.submittedAt.toDate().toLocaleString()
            : "N/A"
        );
      }

      return row;
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    return csvContent;
  }

  function convertToJSON(
    data,
    includeCategories,
    includePractices,
    includeStats
  ) {
    const exportData = data.map((submission) => {
      const item = {
        date: submission.date,
        totalCategories: submission.totalCategories,
        totalPractices: submission.totalPractices,
        totalPoints: submission.totalPoints,
      };

      if (includeCategories) {
        item.categoriesSummary = submission.categories
          .filter((c) => c.isDeleted !== true)
          .map((cat) => ({
            name: cat.name,
            totalPractices: cat.totalPractices,
            totalPoints: cat.totalPoints,
          }));
      }

      if (includePractices) {
        item.individualPractices = submission.categories
          .filter((c) => c.isDeleted !== true)
          .map((cat) => ({
            category: cat.name,
            practices: cat.practices.map((p) => ({
              name: p.name,
              description: p.description || p.originalPracticeData?.description,
              points: p.isDoublePoints ? (p.points || 0) * 2 : p.points || 0,
              isDoublePoints: p.isDoublePoints,
              addedAt: p.addedAt
                ? new Date(p.addedAt).toISOString()
                : undefined,
              isEdited: p.isEdited,
            })),
          }));
      }

      if (includeStats) {
        item.submittedAt =
          submission.submittedAt && submission.submittedAt.toDate
            ? submission.submittedAt.toDate().toISOString()
            : undefined;
        item.lastModified =
          submission.lastModified && submission.lastModified.toDate
            ? submission.lastModified.toDate().toISOString()
            : undefined;
      }

      return item;
    });

    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        totalRecords: exportData.length,
        data: exportData,
      },
      null,
      2
    );
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Print functionality
  function showPrintPreview(data) {
    const printWindow = window.open("", "_blank");
    const printContent = generatePrintContent(
      data.filter((s) => s.isDeleted !== true && s.isActive !== false)
    ); // Only print active data

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = function () {
      printWindow.print();
      printWindow.onafterprint = function () {
        printWindow.close();
      };
    };
  }

  function generatePrintContent(data) {
    const totalPractices = data.reduce((sum, s) => sum + s.totalPractices, 0);
    const totalPoints = data.reduce((sum, s) => sum + s.totalPoints, 0);

    const submissionsHTML = data
      .map((submission) => {
        const date = new Date(submission.date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const categoriesHTML = submission.categories
          .filter((c) => c.isDeleted !== true)
          .map(
            (cat) => `
          <div class="print-category">
            <strong>${cat.name}</strong> - ${cat.totalPractices} practices, ${
              cat.totalPoints
            } points
            <ul>
              ${cat.practices
                .map(
                  (p) =>
                    `<li>${p.name} (${
                      p.isDoublePoints ? (p.points || 0) * 2 : p.points || 0
                    } pts)</li>`
                )
                .join("")}
            </ul>
          </div>
        `
          )
          .join("");

        return `
          <div class="print-submission">
            <h3>${date}</h3>
            <div class="print-stats">
              <span>${submission.totalCategories} Categories</span>
              <span>${submission.totalPractices} Practices</span>
              <span>${submission.totalPoints} Points</span>
            </div>
            <div class="print-categories">
              ${categoriesHTML}
            </div>
          </div>
        `;
      })
      .join("");

    return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Practice History Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .print-summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
            .print-stat { text-align: center; }
            .print-stat h3 { margin: 0; font-size: 24px; color: #007bff; }
            .print-stat p { margin: 5px 0 0 0; color: #666; }
            .print-submission { margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #eee; padding: 15px; border-radius: 8px; }
            .print-submission h3 { color: #333; margin-bottom: 10px; }
            .print-stats { display: flex; gap: 20px; margin-bottom: 15px; font-size: 14px; color: #666; }
            .print-category { margin-bottom: 15px; }
            .print-category ul { margin: 5px 0 0 20px; }
            .print-category li { margin-bottom: 3px; }
            @media print {
              .print-submission { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Practice History Report</h1>
            <p>Generated on ${new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</p>
          </div>

          <div class="print-summary">
            <div class="print-stat">
              <h3>${data.length}</h3>
              <p>Total Sessions</p>
            </div>
            <div class="print-stat">
              <h3>${totalPractices}</h3>
              <p>Total Practices</p>
            </div>
            <div class="print-stat">
              <h3>${totalPoints}</h3>
              <p>Total Points</p>
            </div>
          </div>

          <div class="print-content">
            ${submissionsHTML}
          </div>
        </body>
        </html>
      `;
  }

  // ───────────────────────────────────────────────────────────
  // 11) NOTIFICATION SYSTEM
  // ───────────────────────────────────────────────────────────
  function showNotification(message, type = "info") {
    const container = document.getElementById("notificationContainer");
    if (!container) {
      console.log(message); // Fallback to console if container doesn't exist
      return;
    }

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: inherit; cursor: pointer;">×</button>
  `;

    container.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
      notification.classList.add("show");
    }, 10); // Small delay to allow CSS transition

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 400); // Wait for fade-out animation
      }
    }, 5000);
  }

  // ───────────────────────────────────────────────────────────
  // 12) MODAL EVENT LISTENERS
  // ───────────────────────────────────────────────────────────

  // Close modal when clicking outside
  document.addEventListener("click", function (e) {
    const editModal = document.getElementById("editPracticeModal");
    const detailsModal = document.getElementById("submissionDetailsModal");
    const confirmModal = document.getElementById("confirmationModal");

    if (editModal && e.target === editModal) {
      window.closeEditPracticeModal();
    }
    if (detailsModal && e.target === detailsModal) {
      window.closeSubmissionDetailsModal();
    }
    if (confirmModal && e.target === confirmModal) {
      window.closeConfirmationModal();
    }
  });

  // Close modal with ESC key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      window.closeEditPracticeModal();
      window.closeSubmissionDetailsModal();
      window.closeConfirmationModal();
    }
  });
});

// Additional styles for edit/delete buttons (add to your CSS)
const additionalStyles = `
<style>
/* Edit and Delete Buttons in Modals */
.practice-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.edit-practice-btn, .delete-practice-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s ease;
  font-size: 1.1rem;
  color: #6c757d; /* Default icon color */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.edit-practice-btn:hover {
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
  transform: scale(1.1);
}

.delete-practice-btn:hover {
  background-color: rgba(220, 53, 69, 0.1);
  color: #dc3545;
  transform: scale(1.1);
}

/* Category Delete Button */
.category-actions {
    margin-left: auto; /* Push to the right */
}

.delete-category-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    color: #6c757d;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s ease;
}

.delete-category-btn:hover {
    background-color: rgba(220, 53, 69, 0.1);
    color: #dc3545;
    transform: scale(1.1);
}

/* Specific styles for notification container */
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2000; /* Ensure it's above modals */
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.notification {
    min-width: 300px;
    padding: 15px 20px;
    border-radius: 10px;
    color: white;
    font-weight: 500;
    box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    transform: translateX(400px); /* Start off-screen */
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    position: relative;
    overflow: hidden;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.notification.show {
    transform: translateX(0); /* Slide in */
    opacity: 1;
}
.notification::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 4px;
    background: rgba(255,255,255,0.3);
    animation: notification-progress 4.5s linear forwards; /* Matches auto-remove time */
}
@keyframes notification-progress {
    from { height: 100%; }
    to { height: 0%; }
}

/* confirmation modal styles for history.html (from submit-task.html) */
.confirmation-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    text-align: center;
    padding: 20px 0;
}

.confirmation-icon {
    font-size: 3rem;
    color: #ffc107; /* Warning yellow */
}

.confirmation-message {
    font-size: 1.1rem;
    line-height: 1.5;
    color: #495057; /* Darker text for readability */
}

.modal-footer .btn-danger { /* Ensure red for delete buttons in footer */
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    color: white;
}
.modal-footer .btn-danger:hover {
    background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
}
.modal-footer .btn-secondary { /* Ensure secondary style for cancel */
    background: #6c757d;
    color: white;
}
.modal-footer .btn-secondary:hover {
    background: #545b62;
}

/* Edited indicator */
.edited-indicator {
    font-size: 0.7em;
    vertical-align: super;
    color: #ffc107; /* Yellowish color for "edited" */
    margin-left: 5px;
    cursor: help;
}

/* Double points indicator */
.double-points-indicator {
    font-size: 0.7em;
    vertical-align: super;
    color: #4CAF50; /* Greenish color for "double points" */
    margin-left: 5px;
    cursor: help;
}

.no-practices-message, .empty-state-message {
    text-align: center;
    font-style: italic;
    color: #6c757d;
    padding: 20px;
}
</style>
`;
document.head.insertAdjacentHTML("beforeend", additionalStyles);
