document.addEventListener('DOMContentLoaded', function() {
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
      document.body.style.visibility = 'visible';
      const loaderOverlay = document.getElementById('loaderOverlay');
      loaderOverlay.style.opacity = '0';
      setTimeout(() => {
        loaderOverlay.style.display = 'none';
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
      measurementId: "G-K1HKHPG6HG"
    };
  
    if (!window.firebase) {
      console.error("Firebase SDK not found.");
      const historyContainer = document.querySelector('.history-container');
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
    const database = firebase.database();
    const realtimeDb = firebase.database();
    
    // ───────────────────────────────────────────────────────────
    // 3) AUTH CHECK
    // ───────────────────────────────────────────────────────────
    auth.onAuthStateChanged(user => {
      if (user) {
        console.log("User logged in:", user.uid);
        fetchUserSubmissions(user.uid);
      } else {
        console.log("No user logged in");
        document.querySelector('.history-container').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('emptyState').innerHTML = `
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
    const userSubmissionsRef = db.collection("users").doc(userId).collection("practice_submissions");
    const snapshot = await userSubmissionsRef.orderBy("date", "desc").get();
    
    if (snapshot.empty) {
      console.log("No practice submissions found");
      document.querySelector('.history-container').classList.add('hidden');
      document.getElementById('emptyState').classList.remove('hidden');
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
          lastModified: categoryData.lastModified
        });
      }
      
      // Create submission object from metadata + categories
      const submission = {
        id: doc.id,
        dailySubmissionId: submissionData.dailySubmissionId,
        date: submissionData.date,
        submittedAt: submissionData.submittedAt || submissionData.createdAt,
        lastModified: submissionData.lastModified,
        totalCategories: submissionData.totalCategories || categories.length,
        totalPoints: submissionData.totalPoints || 0,
        totalPractices: submissionData.totalPractices || 0,
        userTotalPoints: submissionData.userTotalPoints || 0,
        userTotalPractices: submissionData.userTotalPractices || 0,
        categories: categories,
        categorySummary: categories.map(cat => cat.name).join(", "),
        isActive: submissionData.isActive !== false // Default to true if not specified
      };
      
      // Only add submissions that have categories or are explicitly marked as active
      if (categories.length > 0 || submission.isActive) {
        submissions.push(submission);
      }
    }
    
    if (submissions.length === 0) {
      console.log("No valid submissions found after processing");
      document.querySelector('.history-container').classList.add('hidden');
      document.getElementById('emptyState').classList.remove('hidden');
    } else {
      console.log(`Found ${submissions.length} valid submissions`);
      allSubmissions = submissions;
      filteredSubmissions = [...allSubmissions];
      initializePage(submissions);
    }
    
  } catch (error) {
    console.error("Error fetching submissions:", error);
    document.querySelector('.history-container').innerHTML = `
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
  populateSubmissionsTimeline(data);
  setupExportButtons(data);
}

function updateStats(data) {
  const totalSubmissions = data.length;
  
  // Calculate total practices from metadata (more accurate)
  const totalPractices = data.reduce((sum, submission) => sum + (submission.totalPractices || 0), 0);
  
  document.getElementById('totalPractices').textContent = totalPractices;
  
  let currentStreak = calculateCurrentStreak(data);
  document.getElementById('currentStreak').textContent = currentStreak;
  
  let longestStreak = calculateLongestStreak(data);
  document.getElementById('longestStreak').textContent = longestStreak;
  
  // Update the stat card titles to be more accurate
  document.querySelector('.stat-card h3').textContent = 'Total Practices';
  document.querySelector('.stat-card .stat-detail').textContent = 'Individual practices completed';
  
  console.log(`Stats updated: ${totalPractices} practices, ${currentStreak} current streak, ${longestStreak} longest streak`);
}

function calculateCurrentStreak(data) {
  if (data.length === 0) return 0;
  
  const sortedData = [...data].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
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
      const daysDiff = Math.floor((today - submissionDate) / (1000 * 60 * 60 * 24));
      if (daysDiff > 1) {
        break; // Gap too large, no current streak
      }
      streak = 1;
    } else {
      // Subsequent submissions should be consecutive days
      const prevDate = new Date(sortedData[i - 1].date);
      prevDate.setHours(0, 0, 0, 0);
      expectedDate = new Date(prevDate - 24 * 60 * 60 * 1000); // Previous day
      
      if (submissionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break; // Streak broken
      }
    }
  }
  
  return streak;
}

function calculateLongestStreak(data) {
  if (data.length === 0) return 0;
  
  const sortedData = [...data].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  let currentStreak = 1;
  let maxStreak = 1;
  
  for (let i = 0; i < sortedData.length - 1; i++) {
    const currentDate = new Date(sortedData[i].date);
    currentDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(sortedData[i + 1].date);
    nextDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((nextDate - currentDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return maxStreak;
}

function populateMostPracticed(data) {
  const container = document.getElementById('mostPracticedContainer');
  container.innerHTML = '';
  
  const categoryCount = {};
  const categoryPoints = {};
  
  // Count category occurrences and total points
  data.forEach(submission => {
    submission.categories.forEach(category => {
      const categoryName = category.name;
      categoryCount[categoryName] = (categoryCount[categoryName] || 0) + 1;
      categoryPoints[categoryName] = (categoryPoints[categoryName] || 0) + (category.totalPoints || 0);
    });
  });
  
  const sortedCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Show top 5 instead of 3
  
  const totalSubmissions = data.length;
  const categoriesToShow = sortedCategories.filter(c => c[1] >= 1); // Show categories with at least 1 submission
  
  if (categoriesToShow.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p>No categories have been practiced yet.</p>
      </div>
    `;
    return;
  }
  
  categoriesToShow.forEach(([categoryName, count]) => {
    const percentage = Math.round((count / totalSubmissions) * 100);
    const totalPoints = categoryPoints[categoryName] || 0;
    
    const categoryEl = document.createElement('div');
    categoryEl.className = 'practice-progress';
    categoryEl.innerHTML = `
      <h3>${categoryName}</h3>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
        <span class="progress-text">${count} times (${totalPoints} pts)</span>
      </div>
    `;
    
    container.appendChild(categoryEl);
  });
}


/// ───────────────────────────────────────────────────────────
// ENHANCED REAL-TIME PRACTICE EDITING SYSTEM
// ───────────────────────────────────────────────────────────

// Global variables for tracking current editing state
// Already declared at the top of the script, just reset values here if needed
currentEditingSubmissionId = null;
currentEditingCategoryId = null;
currentEditingPracticeId = null;
currentViewingSubmission = null;

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
// UTILITY FUNCTIONS FOR REAL-TIME SYNC
// ───────────────────────────────────────────────────────────

/**
 * Updates a specific practice in the allSubmissions array
 * This ensures all UI components stay in sync
 */
function updatePracticeInLocalData(submissionId, categoryId, practiceIndex, updatedPractice) {
  const submission = allSubmissions.find(s => s.id === submissionId);
  if (!submission) return false;
  
  const category = submission.categories.find(c => c.id === categoryId);
  if (!category) return false;
  
  if (!category.practices[practiceIndex]) return false;
  
  // Update the practice
  category.practices[practiceIndex] = {
    ...category.practices[practiceIndex],
    ...updatedPractice
  };
  
  // Recalculate category totals
  category.totalPoints = category.practices.reduce((sum, p) => sum + (p.points || 0), 0);
  category.totalPractices = category.practices.length;
  
  // Recalculate submission totals
  submission.totalPoints = submission.categories.reduce((sum, cat) => sum + cat.totalPoints, 0);
  submission.totalPractices = submission.categories.reduce((sum, cat) => sum + cat.totalPractices, 0);
  submission.totalCategories = submission.categories.length;
  
  // Update category summary for timeline display
  submission.categorySummary = submission.categories.map(cat => cat.name).join(', ');
  
  return true;
}

/**
 * Refreshes all UI components that display practice data
 */
function refreshAllUIComponents() {
  // 1. Refresh timeline if it exists
  const timelineContainer = document.getElementById('timelineContainer');
  if (timelineContainer && typeof populateSubmissionsTimeline === 'function') {
    // Get current filter settings if they exist
    const currentFilter = document.getElementById('categoryFilter')?.value || 'all';
    const startDate = document.getElementById('startDate')?.value || null;
    const endDate = document.getElementById('endDate')?.value || null;
    
    populateSubmissionsTimeline(allSubmissions, currentFilter, startDate, endDate);
  }
  
  // 2. Refresh submission details modal if it's open
  if (currentViewingSubmission) {
    const updatedSubmission = allSubmissions.find(s => s.id === currentViewingSubmission.id);
    if (updatedSubmission) {
      currentViewingSubmission = updatedSubmission;
      showSubmissionDetailsModal(updatedSubmission);
    }
  }
  
  // 3. Refresh any other dashboard components that might display this data
  if (typeof refreshDashboardStats === 'function') {
    refreshDashboardStats();
  }
}

/**
 * Updates a specific timeline item without full refresh
 * Shows detailed information about categories, practices, and points
 */
function updateTimelineItem(submissionId) {
  const timelineItem = document.querySelector(`[data-submission-id="${submissionId}"]`);
  if (!timelineItem) return;
  
  const submission = allSubmissions.find(s => s.id === submissionId);
  if (!submission) return;
  
  // Format the date
  const date = new Date(submission.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Format submission time
  let timeInfo = '';
  if (submission.submittedAt) {
    const submittedTime = submission.submittedAt.toDate ?
      submission.submittedAt.toDate() :
      new Date(submission.submittedAt);
    timeInfo = ` at ${submittedTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
  
  // Generate detailed category breakdown
  let categoryBreakdown = '';
  submission.categories.forEach((category, index) => {
    const practices = category.practices || [];
    const practicesList = practices.map(practice => {
      const practiceName = practice.name || practice.practiceDescription || 'Unnamed Practice';
      const practicePoints = practice.points || 0;
      return `${practiceName} (${practicePoints}pts)`;
    }).join(', ');
    
    categoryBreakdown += `
      <div class="category-breakdown">
        <strong>${category.name}:</strong> 
        <span class="category-stats-inline">${practices.length} practices, ${category.totalPoints || 0} points</span>
        ${practices.length > 0 ? `<div class="practices-list-inline">${practicesList}</div>` : ''}
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
          <button class="view-details-btn" onclick="viewSubmissionDetails('${submission.id}', '${submission.dailySubmissionId || ''}')">
            <i class="fas fa-eye"></i> View Details
          </button>
        </div>
      </div>
      <div class="submission-summary">
        <div class="submission-stats">
          <span><i class="fas fa-list"></i> ${submission.totalCategories || 0} Categories</span>
          <span><i class="fas fa-dumbbell"></i> ${submission.totalPractices || 0} Practices</span>
          <span><i class="fas fa-star"></i> ${submission.totalPoints || 0} Points</span>
        </div>
        <div class="detailed-breakdown">
          ${categoryBreakdown}
        </div>
      </div>
    </div>
  `;
  
  // Add some inline styles for better presentation if they don't exist in CSS
  const style = document.createElement('style');
  if (!document.getElementById('timeline-update-styles')) {
    style.id = 'timeline-update-styles';
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

window.editPractice = function(submissionId, categoryId, practiceIndex) {
  const submission = allSubmissions.find(s => s.id === submissionId);
  if (!submission) {
    showNotification('Submission not found', 'error');
    return;
  }
  
  const category = submission.categories.find(c => c.id === categoryId);
  if (!category) {
    showNotification('Category not found', 'error');
    return;
  }
  
  const practice = category.practices[practiceIndex];
  if (!practice) {
    showNotification('Practice not found', 'error');
    return;
  }
  
  currentEditingSubmissionId = submissionId;
  currentEditingCategoryId = categoryId;
  currentEditingPracticeId = practiceIndex;
  
  showEditPracticeModal(practice);
};

function showEditPracticeModal(practice) {
  // Create or update edit modal
  let modal = document.getElementById('editPracticeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editPracticeModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  
  // Generate category options
  let categoryOptions = '';
  let selectedCategory = '';
  
  // Find which category contains the current practice
  for (const [categoryName, practices] of Object.entries(practicesData)) {
    const foundPractice = practices.find(p => p.name === practice.name);
    if (foundPractice) {
      selectedCategory = categoryName;
    }
    categoryOptions += `<option value="${categoryName}" ${categoryName === selectedCategory ? 'selected' : ''}>${categoryName}</option>`;
  }
  
  // Generate practice options for the selected category
  let practiceOptions = '';
  if (selectedCategory && practicesData[selectedCategory]) {
    practicesData[selectedCategory].forEach(p => {
      const selected = p.name === practice.name ? 'selected' : '';
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
            <textarea id="editPracticeDescription" rows="3" readonly>${practice.description || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label for="editPracticePoints">Points</label>
            <input type="number" id="editPracticePoints" value="${practice.points || 0}" min="0" readonly>
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
  modal.style.zIndex = '1001';
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

window.closeEditPracticeModal = function() {
  const modal = document.getElementById('editPracticeModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.style.zIndex = ''; // Reset z-index
  }
  currentEditingSubmissionId = null;
  currentEditingCategoryId = null;
  currentEditingPracticeId = null;
};

// Helper function to update practice options when category changes
window.updatePracticeOptions = function() {
  const categorySelect = document.getElementById('editPracticeCategory');
  const practiceSelect = document.getElementById('editPracticeName');
  const descriptionTextarea = document.getElementById('editPracticeDescription');
  const pointsInput = document.getElementById('editPracticePoints');
  
  if (!categorySelect || !practiceSelect) return;
  
  const selectedCategory = categorySelect.value;
  
  // Clear current options
  practiceSelect.innerHTML = '<option value="">Select Practice</option>';
  descriptionTextarea.value = '';
  pointsInput.value = 0;
  
  if (selectedCategory && practicesData[selectedCategory]) {
    practicesData[selectedCategory].forEach(practice => {
      const option = document.createElement('option');
      option.value = practice.name;
      option.textContent = practice.name;
      option.setAttribute('data-description', practice.description);
      option.setAttribute('data-points', practice.points);
      practiceSelect.appendChild(option);
    });
  }
};

// Helper function to update description and points when practice changes
window.updatePracticeDetails = function() {
  const practiceSelect = document.getElementById('editPracticeName');
  const descriptionTextarea = document.getElementById('editPracticeDescription');
  const pointsInput = document.getElementById('editPracticePoints');
  
  if (!practiceSelect || !descriptionTextarea || !pointsInput) return;
  
  const selectedOption = practiceSelect.options[practiceSelect.selectedIndex];
  
  if (selectedOption && selectedOption.value) {
    descriptionTextarea.value = selectedOption.getAttribute('data-description') || '';
    pointsInput.value = selectedOption.getAttribute('data-points') || 0;
  } else {
    descriptionTextarea.value = '';
    pointsInput.value = 0;
  }
};

// ───────────────────────────────────────────────────────────
// ENHANCED SAVE FUNCTION WITH REAL-TIME SYNC
// ───────────────────────────────────────────────────────────

window.saveEditedPractice = async function() {
  if (currentEditingSubmissionId === null || currentEditingCategoryId === null || currentEditingPracticeId === null) {
    showNotification('Invalid editing state', 'error');
    return;
  }
  
  const user = auth.currentUser;
  if (!user) {
    showNotification('Please log in to edit practices', 'error');
    return;
  }
  
  // Get selected values
  const selectedPracticeName = document.getElementById('editPracticeName').value;
  const selectedDescription = document.getElementById('editPracticeDescription').value;
  const selectedPoints = parseInt(document.getElementById('editPracticePoints').value) || 0;
  
  if (!selectedPracticeName) {
    showNotification('Please select a practice', 'error');
    return;
  }
  
  // Show loading state
  const saveButton = document.querySelector('#editPracticeForm button[type="submit"]');
  const originalButtonText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  saveButton.disabled = true;
  
  try {
    const updatedPractice = {
      name: selectedPracticeName,
      description: selectedDescription,
      points: selectedPoints,
      lastModified: firebase.firestore.Timestamp.now()
    };
    
    // Get the current category document
    const categoryRef = db.collection("users")
      .doc(user.uid)
      .collection("practice_submissions")
      .doc(currentEditingSubmissionId)
      .collection("categories")
      .doc(currentEditingCategoryId);
    
    const categoryDoc = await categoryRef.get();
    if (!categoryDoc.exists) {
      throw new Error('Category not found');
    }
    
    const categoryData = categoryDoc.data();
    const practices = categoryData.practices || [];
    
    // Update the specific practice
    practices[currentEditingPracticeId] = {
      ...practices[currentEditingPracticeId],
      ...updatedPractice
    };
    
    // Recalculate totals
    const totalPoints = practices.reduce((sum, p) => sum + (p.points || 0), 0);
    
    // Update both Firestore and Realtime Database
await Promise.all([
  // Update Firestore
  categoryRef.update({
    practices: practices,
    totalPoints: totalPoints,
    lastModified: firebase.firestore.Timestamp.now()
  }),
  
  // Update Realtime Database
  realtimeDb.ref(`users/${user.uid}/practice_submissions/${currentEditingSubmissionId}/categories/${currentEditingCategoryId}`).update({
    practices: practices,
    totalPoints: totalPoints,
    lastModified: firebase.database.ServerValue.TIMESTAMP
  })
]);
    
    // *** REAL-TIME SYNC: Update local data immediately ***
    const localUpdateSuccess = updatePracticeInLocalData(
      currentEditingSubmissionId, 
      currentEditingCategoryId, 
      currentEditingPracticeId, 
      updatedPractice
    );
    
    if (localUpdateSuccess) {
      // Update specific timeline item without full refresh for better performance
      updateTimelineItem(currentEditingSubmissionId);
      
      // If submission details modal is open, refresh it with updated data
      if (currentViewingSubmission && currentViewingSubmission.id === currentEditingSubmissionId) {
        const updatedSubmission = allSubmissions.find(s => s.id === currentEditingSubmissionId);
        if (updatedSubmission) {
          currentViewingSubmission = updatedSubmission;
          showSubmissionDetailsModal(updatedSubmission);
        }
      }
    } else {
      // Fallback: full refresh if local update failed
      console.warn('Local update failed, performing full refresh');
      await fetchUserSubmissions(user.uid);
      refreshAllUIComponents();
    }
    
    showNotification('Practice updated successfully!', 'success');
    closeEditPracticeModal();
    
  } catch (error) {
    console.error('Error updating practice:', error);
    showNotification('Error updating practice. Please try again.', 'error');
    
    // Reset button state on error
    saveButton.innerHTML = originalButtonText;
    saveButton.disabled = false;
  }
};

// ───────────────────────────────────────────────────────────
// ENHANCED SUBMISSION DETAILS MODAL
// ───────────────────────────────────────────────────────────

window.viewSubmissionDetails = function(submissionId, dailySubmissionId = null) {
  let submission;
  
  // Handle both old and new function signatures
  if (dailySubmissionId) {
    submission = allSubmissions.find(s => s.id === submissionId || s.dailySubmissionId === dailySubmissionId);
  } else {
    submission = allSubmissions.find(s => s.id === submissionId);
  }
  
  if (!submission) {
    showNotification('Submission not found', 'error');
    return;
  }
  
  currentViewingSubmission = submission;
  showSubmissionDetailsModal(submission);
};

function showSubmissionDetailsModal(submission) {
  // Create modal if it doesn't exist
  let modal = document.getElementById('submissionDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'submissionDetailsModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }
  
  const date = new Date(submission.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Enhanced practice display with real-time editing capabilities
  let categoriesHTML = '';
  submission.categories.forEach(category => {
    let practicesHTML = '';
    category.practices.forEach((practice, index) => {
      // Handle both old and new data structures
      const practiceName = practice.name || practice.practiceDescription || 'Unnamed Practice';
      const practiceDesc = practice.description || practice.practiceDescription || 'No description';
      const practicePoints = practice.points || 0;
      
      practicesHTML += `
        <div class="practice-item" data-practice-index="${index}">
          <div class="practice-info">
            <h5>${practiceName}</h5>
            <p>${practiceDesc}</p>
            <div class="practice-meta">
              <span class="points-display">Points: ${practicePoints}${practice.isDoublePoints ? ' (Double Points!)' : ''}</span>
              ${practice.addedAt ? `<span>Added: ${new Date(practice.addedAt).toLocaleTimeString()}</span>` : ''}
              ${practice.lastModified ? `<span>Modified: ${new Date(practice.lastModified.toDate()).toLocaleTimeString()}</span>` : ''}
            </div>
          </div>
          <div class="practice-actions">
            <button class="edit-practice-btn" onclick="editPractice('${submission.id}', '${category.id}', ${index})" title="Edit Practice">
              <i class="fas fa-edit"></i>
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
            <span class="practices-count">${category.totalPractices} practices</span>
            <span class="points-count">${category.totalPoints} points</span>
          </div>
        </div>
        <div class="practices-list">
          ${practicesHTML}
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
              <span class="stat-value categories-total">${submission.totalCategories}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Practices</span>
              <span class="stat-value practices-total">${submission.totalPractices}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Points</span>
              <span class="stat-value points-total">${submission.totalPoints}</span>
            </div>
          </div>
        </div>
        
        <div class="categories-container">
          ${categoriesHTML}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" onclick="closeSubmissionDetailsModal()">
          <i class="fas fa-arrow-left"></i> Back
        </button>
      </div>
    </div>
  `;
  
  // Set base z-index for details modal
  modal.style.zIndex = '1000';
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

window.closeSubmissionDetailsModal = function() {
  const modal = document.getElementById('submissionDetailsModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.style.zIndex = ''; // Reset z-index
  }
  currentViewingSubmission = null;
};

// ───────────────────────────────────────────────────────────
// ENHANCED TIMELINE POPULATION WITH SYNC SUPPORT
// ───────────────────────────────────────────────────────────

function populateSubmissionsTimeline(data, filterType = 'all', startDate = null, endDate = null) {
  const container = document.getElementById('timelineContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Filter data based on parameters
  let filteredData = [...data];
  
  if (filterType !== 'all') {
    filteredData = filteredData.filter(submission =>
      submission.categories.some(cat => cat.name === filterType)
    );
  }
  
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    filteredData = filteredData.filter(submission => {
      const submissionDate = new Date(submission.date);
      submissionDate.setHours(0, 0, 0, 0);
      return submissionDate >= start;
    });
  }
  
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filteredData = filteredData.filter(submission => {
      const submissionDate = new Date(submission.date);
      return submissionDate <= end;
    });
  }
  
  // Sort by date (newest first)
  filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (filteredData.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <p>No practice submissions found for the selected filters.</p>
      </div>
    `;
    return;
  }
  
  // Create timeline items for submissions
  filteredData.forEach(submission => {
    const date = new Date(submission.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Format submission time
    let timeInfo = '';
    if (submission.submittedAt) {
      const submittedTime = submission.submittedAt.toDate ?
        submission.submittedAt.toDate() :
        new Date(submission.submittedAt);
      timeInfo = ` at ${submittedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
    
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item submission-item';
    timelineItem.setAttribute('data-submission-id', submission.id);
    if (submission.dailySubmissionId) {
      timelineItem.setAttribute('data-daily-submission-id', submission.dailySubmissionId);
    }
    
    timelineItem.innerHTML = `
      <div class="timeline-date">${formattedDate}${timeInfo}</div>
      <div class="timeline-content">
        <div class="submission-header">
          <h3>Practice Session</h3>
          <div class="submission-actions">
            <button class="view-details-btn" onclick="viewSubmissionDetails('${submission.id}', '${submission.dailySubmissionId || ''}')">
              <i class="fas fa-eye"></i> View Details
            </button>
          </div>
        </div>
        <div class="submission-summary">
          <p><strong>Categories:</strong> ${submission.categorySummary || 'No categories'}</p>
          <div class="submission-stats">
            <span><i class="fas fa-list"></i> ${submission.totalCategories || 0} Categories</span>
            <span><i class="fas fa-dumbbell"></i> ${submission.totalPractices || 0} Practices</span>
            <span><i class="fas fa-star"></i> ${submission.totalPoints || 0} Points</span>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(timelineItem);
  });
  
  console.log(`Timeline populated with ${filteredData.length} submissions`);
}


// ───────────────────────────────────────────────────────────
// INITIALIZATION AND EVENT LISTENERS
// ───────────────────────────────────────────────────────────

// Ensure this runs after DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Enhanced Practice Editing System initialized');
  
  // Add any additional event listeners here if needed
  // For example, keyboard shortcuts for editing
  document.addEventListener('keydown', function(e) {
    // ESC key to close modals
    if (e.key === 'Escape') {
      closeEditPracticeModal();
    }
  });
});


    // ───────────────────────────────────────────────────────────
    // 10) EXPORT FUNCTIONALITY (COMPLETED)
    // ───────────────────────────────────────────────────────────
    function setupExportButtons(data) {
      const exportCsvBtn = document.getElementById('exportCsvBtn');
      const printHistoryBtn = document.getElementById('printHistoryBtn');
      
      exportCsvBtn.addEventListener('click', function() {
        showExportModal(data);
      });
      
      printHistoryBtn.addEventListener('click', function() {
        showPrintPreview(data);
      });
    }
    
    // Show Export Modal with options
    function showExportModal(data) {
      let modal = document.getElementById('exportModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exportModal';
        modal.className = 'modal-overlay';
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
        const dates = data.map(s => s.date).sort();
        document.getElementById('exportStartDate').value = dates[0];
        document.getElementById('exportEndDate').value = dates[dates.length - 1];
      }
      
      // Add event listeners for preview updates
      modal.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => updateExportPreview(data));
      });
      
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      updateExportPreview(data);
    }
    
    function updateExportPreview(data) {
      const startDate = document.getElementById('exportStartDate')?.value;
      const endDate = document.getElementById('exportEndDate')?.value;
      
      let filteredData = data;
      if (startDate) {
        filteredData = filteredData.filter(s => s.date >= startDate);
      }
      if (endDate) {
        filteredData = filteredData.filter(s => s.date <= endDate);
      }
      
      const previewStats = document.getElementById('exportPreviewStats');
      if (previewStats) {
        const dateRangeText = startDate && endDate ? 
          `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` : 
          'All Time';
        
        previewStats.innerHTML = `
          <span>Total Records: ${filteredData.length}</span>
          <span>Date Range: ${dateRangeText}</span>
          <span>Total Practices: ${filteredData.reduce((sum, s) => sum + s.totalPractices, 0)}</span>
        `;
      }
    }
    
    window.closeExportModal = function() {
      const modal = document.getElementById('exportModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    };
    
    window.executeExport = function() {
      const format = document.querySelector('input[name="exportFormat"]:checked').value;
      const startDate = document.getElementById('exportStartDate').value;
      const endDate = document.getElementById('exportEndDate').value;
      const includeCategories = document.getElementById('includeCategories').checked;
      const includePractices = document.getElementById('includePractices').checked;
      const includeStats = document.getElementById('includeStats').checked;
      
      // Filter data by date range
      let exportData = [...allSubmissions];
      if (startDate) {
        exportData = exportData.filter(s => s.date >= startDate);
      }
      if (endDate) {
        exportData = exportData.filter(s => s.date <= endDate);
      }
      
      if (format === 'csv') {
        const csvContent = convertToCSV(exportData, includeCategories, includePractices, includeStats);
        downloadFile(csvContent, 'practice-history.csv', 'text/csv');
      } else if (format === 'json') {
        const jsonContent = convertToJSON(exportData, includeCategories, includePractices, includeStats);
        downloadFile(jsonContent, 'practice-history.json', 'application/json');
      }
      
      closeExportModal();
      showNotification('Export completed successfully!', 'success');
    };
    
    function convertToCSV(data, includeCategories, includePractices, includeStats) {
      const headers = ['Date', 'Total Categories', 'Total Practices', 'Total Points'];
      
      if (includeCategories) {
        headers.push('Categories');
      }
      
      if (includePractices) {
        headers.push('Practice Details');
      }
      
      if (includeStats) {
        headers.push('Submission Time');
      }
      
      const rows = data.map(submission => {
        const row = [
          submission.date,
          submission.totalCategories,
          submission.totalPractices,
          submission.totalPoints
        ];
        
        if (includeCategories) {
          row.push(submission.categorySummary);
        }
        
        if (includePractices) {
          const practiceDetails = submission.categories.map(cat => 
            `${cat.name}: ${cat.practices.map(p => p.name).join(', ')}`
          ).join(' | ');
          row.push(practiceDetails);
        }
        
        if (includeStats) {
          row.push(new Date(submission.submittedAt.seconds * 1000).toLocaleString());
        }
        
        return row;
      });
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      return csvContent;
    }
    
    function convertToJSON(data, includeCategories, includePractices, includeStats) {
      const exportData = data.map(submission => {
        const item = {
          date: submission.date,
          totalCategories: submission.totalCategories,
          totalPractices: submission.totalPractices,
          totalPoints: submission.totalPoints
        };
        
        if (includeCategories) {
          item.categories = submission.categories.map(cat => ({
            name: cat.name,
            totalPractices: cat.totalPractices,
            totalPoints: cat.totalPoints
          }));
        }
        
        if (includePractices) {
          item.practiceDetails = submission.categories.map(cat => ({
            category: cat.name,
            practices: cat.practices.map(p => ({
              name: p.name,
              description: p.description,
              points: p.points
            }))
          }));
        }
        
        if (includeStats) {
          item.submittedAt = new Date(submission.submittedAt.seconds * 1000).toISOString();
        }
        
        return item;
      });
      
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        totalRecords: exportData.length,
        data: exportData
      }, null, 2);
    }
    
    function downloadFile(content, filename, mimeType) {
      const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    
    // Print functionality
    function showPrintPreview(data) {
      const printWindow = window.open('', '_blank');
      const printContent = generatePrintContent(data);
      
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      printWindow.onload = function() {
        printWindow.print();
        printWindow.onafterprint = function() {
          printWindow.close();
        };
      };
    }
    
    function generatePrintContent(data) {
      const totalPractices = data.reduce((sum, s) => sum + s.totalPractices, 0);
      const totalPoints = data.reduce((sum, s) => sum + s.totalPoints, 0);
      
      const submissionsHTML = data.map(submission => {
        const date = new Date(submission.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        const categoriesHTML = submission.categories.map(cat => `
          <div class="print-category">
            <strong>${cat.name}</strong> - ${cat.totalPractices} practices, ${cat.totalPoints} points
            <ul>
              ${cat.practices.map(p => `<li>${p.name} (${p.points} pts)</li>`).join('')}
            </ul>
          </div>
        `).join('');
        
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
      }).join('');
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Practice History Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .print-summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
            .print-stat { text-align: center; }
            .print-stat h3 { margin: 0; font-size: 24px; color: #007bff; }
            .print-stat p { margin: 5px 0 0 0; color: #666; }
            .print-submission { margin-bottom: 25px; page-break-inside: avoid; }
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
            <p>Generated on ${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
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
    function showNotification(message, type = 'info') {
      const container = document.getElementById('notificationContainer');
      if (!container) {
        console.log(message); // Fallback to console if container doesn't exist
        return;
      }
      
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: inherit; cursor: pointer;">×</button>
      `;
      
      container.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 5000);
    }
    
    // ───────────────────────────────────────────────────────────
    // 12) MODAL EVENT LISTENERS
    // ───────────────────────────────────────────────────────────
    
    // Close modal when clicking outside
    document.addEventListener('click', function(e) {
      const modal = document.getElementById('editModal');
      if (e.target === modal) {
        closeEditModal();
      }
    });
    
    // Close modal with ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeEditModal();
      }
    });
    
});

// Additional styles for edit/delete buttons (add to your CSS)
const additionalStyles = `
<style>
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.timeline-actions {
  display: flex;
  gap: 8px;
}

.edit-btn, .delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.edit-btn:hover {
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
}

.delete-btn:hover {
  background-color: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.notification {
  background: #007bff;
  color: white;
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification.success {
  background: #28a745;
}

.notification.error {
  background: #dc3545;
}

.notification.warning {
  background: #ffc107;
  color: #212529;
}

.timeline-stats {
  display: flex;
  gap: 15px;
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
}

.timeline-stats span {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
}
</style>
`;

// Inject additional styles
document.head.insertAdjacentHTML('beforeend', additionalStyles);