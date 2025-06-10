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
    // 4) FETCH USER SUBMISSIONS DATA
    // ───────────────────────────────────────────────────────────
    async function fetchUserSubmissions(userId) {
      try {
        const userSubmissionsRef = db.collection("users").doc(userId).collection("practice_submissions");
        const snapshot = await userSubmissionsRef.orderBy("submittedAt", "desc").get();
        
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
          
          // Get categories for this submission
          const categoriesSnapshot = await doc.ref.collection("categories").get();
          const categories = [];
          
          for (const catDoc of categoriesSnapshot.docs) {
            const categoryData = catDoc.data();
            const practices = categoryData.practices || [];
            
            categories.push({
              id: catDoc.id,
              name: categoryData.categoryDisplayName || categoryData.category,
              practices: practices,
              totalPoints: categoryData.totalPoints || 0,
              totalPractices: categoryData.totalPractices || practices.length
            });
          }
          
          const submission = {
            id: doc.id,
            date: submissionData.date,
            submittedAt: submissionData.submittedAt,
            totalCategories: submissionData.totalCategories || categories.length,
            totalPoints: submissionData.totalPoints || 0,
            totalPractices: submissionData.totalPractices || 0,
            categories: categories,
            categorySummary: categories.map(cat => cat.name).join(", ")
          };
          
          submissions.push(submission);
        }
        
        if (submissions.length === 0) {
          document.querySelector('.history-container').classList.add('hidden');
          document.getElementById('emptyState').classList.remove('hidden');
        } else {
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
    // 5) INITIALIZE PAGE FUNCTIONS
    // ───────────────────────────────────────────────────────────
    function initializePage(data) {
      updateStats(data);
      populateMostPracticed(data);
      populateSubmissionsTimeline(data);
      setupFilters(data);
      setupExportButtons(data);
    }
    
    function updateStats(data) {
      const totalSubmissions = data.length;
      const totalPractices = data.reduce((sum, submission) => sum + submission.totalPractices, 0);
      
      document.getElementById('totalPractices').textContent = totalPractices;
      
      let currentStreak = calculateCurrentStreak(data);
      document.getElementById('currentStreak').textContent = currentStreak;
      
      let longestStreak = calculateLongestStreak(data);
      document.getElementById('longestStreak').textContent = longestStreak;
      
      // Update the stat card titles to be more accurate
      document.querySelector('.stat-card h3').textContent = 'Total Practices';
      document.querySelector('.stat-card .stat-detail').textContent = 'Individual practices completed';
    }
    
    function calculateCurrentStreak(data) {
      if (data.length === 0) return 0;
      
      const sortedData = [...data].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      let streak = 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const mostRecentDate = new Date(sortedData[0].date);
      const dayDiff = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff > 1) {
        return 0;
      }
      
      for (let i = 0; i < sortedData.length - 1; i++) {
        const currentDate = new Date(sortedData[i].date);
        const prevDate = new Date(sortedData[i + 1].date);
        const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          streak++;
        } else {
          break;
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
        const nextDate = new Date(sortedData[i + 1].date);
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
      data.forEach(submission => {
        submission.categories.forEach(category => {
          categoryCount[category.name] = (categoryCount[category.name] || 0) + 1;
        });
      });
      
      const sortedCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      const totalSubmissions = data.length;
      const categoriesToShow = sortedCategories.filter(c => c[1] >= 2);
      
      if (categoriesToShow.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 20px;">
            <p>No category has been practiced more than 2 times yet.</p>
          </div>
        `;
        return;
      }
      
      categoriesToShow.forEach(([categoryName, count]) => {
        const percentage = Math.round((count / totalSubmissions) * 100);
        
        const categoryEl = document.createElement('div');
        categoryEl.className = 'practice-progress';
        categoryEl.innerHTML = `
          <h3>${categoryName}</h3>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${percentage}%"></div>
            <span class="progress-text">${count} times (${percentage}%)</span>
          </div>
        `;
        
        container.appendChild(categoryEl);
      });
    }
    
    // ───────────────────────────────────────────────────────────
    // 6) SUBMISSIONS TIMELINE
    // ───────────────────────────────────────────────────────────
    function populateSubmissionsTimeline(data, filterType = 'all', startDate = null, endDate = null) {
      const container = document.getElementById('timelineContainer');
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
        filteredData = filteredData.filter(submission => new Date(submission.date) >= start);
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        filteredData = filteredData.filter(submission => new Date(submission.date) <= end);
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
        
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item submission-item';
        timelineItem.setAttribute('data-submission-id', submission.id);
        
        timelineItem.innerHTML = `
          <div class="timeline-date">${formattedDate}</div>
          <div class="timeline-content">
            <div class="submission-header">
              <h3>Practice Session</h3>
              <button class="view-details-btn" onclick="viewSubmissionDetails('${submission.id}')">
                <i class="fas fa-eye"></i> View Details
              </button>
            </div>
            <div class="submission-summary">
              <p><strong>Categories:</strong> ${submission.categorySummary}</p>
              <div class="submission-stats">
                <span><i class="fas fa-list"></i> ${submission.totalCategories} Categories</span>
                <span><i class="fas fa-dumbbell"></i> ${submission.totalPractices} Practices</span>
                <span><i class="fas fa-star"></i> ${submission.totalPoints} Points</span>
              </div>
            </div>
          </div>
        `;
        
        container.appendChild(timelineItem);
      });
    }

    
// ───────────────────────────────────────────────────────────
// 8) EDIT PRACTICE FUNCTIONALITY
// ───────────────────────────────────────────────────────────

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
    
    // Update the category document
    await categoryRef.update({
      practices: practices,
      totalPoints: totalPoints,
      lastModified: firebase.firestore.Timestamp.now()
    });
    
    showNotification('Practice updated successfully!', 'success');
    closeEditPracticeModal();
    
    // Refresh the data
    await fetchUserSubmissions(user.uid);
    
    // Reopen the submission details if it was open
    if (currentViewingSubmission) {
      const updatedSubmission = allSubmissions.find(s => s.id === currentEditingSubmissionId);
      if (updatedSubmission) {
        showSubmissionDetailsModal(updatedSubmission);
      }
    }
    
  } catch (error) {
    console.error('Error updating practice:', error);
    showNotification('Error updating practice. Please try again.', 'error');
  }
};

// ───────────────────────────────────────────────────────────
// 7) SUBMISSION DETAILS MODAL
// ───────────────────────────────────────────────────────────
window.viewSubmissionDetails = function(submissionId) {
  const submission = allSubmissions.find(s => s.id === submissionId);
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
  
  // Fixed practice display section in showSubmissionDetailsModal function
let categoriesHTML = '';
submission.categories.forEach(category => {
  let practicesHTML = '';
  category.practices.forEach((practice, index) => {
    // Handle both old and new data structures
    const practiceName = practice.name || practice.practiceDescription || 'Unnamed Practice';
    const practiceDesc = practice.description || practice.practiceDescription || 'No description';
    const practicePoints = practice.points || 0;
    
    practicesHTML += `
      <div class="practice-item">
        <div class="practice-info">
          <h5>${practiceName}</h5>
          <p>${practiceDesc}</p>
          <div class="practice-meta">
            <span>Points: ${practicePoints}${practice.isDoublePoints ? ' (Double Points!)' : ''}</span>
            ${practice.addedAt ? `<span>Added: ${new Date(practice.addedAt).toLocaleTimeString()}</span>` : ''}
          </div>
        </div>
        <div class="practice-actions">
          <button class="edit-practice-btn" onclick="editPractice('${submission.id}', '${category.id}', ${index})" title="Edit Practice">
            <i class="fas fa-edit"></i>
          </button>
          <button class="delete-practice-btn" onclick="deletePractice('${submission.id}', '${category.id}', ${index})" title="Delete Practice">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  categoriesHTML += `
    <div class="category-section">
      <div class="category-header">
        <h4>${category.name}</h4>
        <div class="category-stats">
          <span>${category.totalPractices} practices</span>
          <span>${category.totalPoints} points</span>
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
              <span class="stat-value">${submission.totalCategories}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Practices</span>
              <span class="stat-value">${submission.totalPractices}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Points</span>
              <span class="stat-value">${submission.totalPoints}</span>
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
// ENHANCED DELETE PRACTICE FUNCTIONALITY - CROSS-BROWSER COMPATIBLE
// ───────────────────────────────────────────────────────────

// Enhanced confirmation dialog with modern design
function showDeleteConfirmationDialog(practiceDescription, onConfirm, onCancel) {
  // Create modal overlay with modern styling
  const overlay = document.createElement('div');
  overlay.id = 'delete-confirmation-overlay';
  
  // Cross-browser compatible styles
  const overlayStyles = {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '9999',
    padding: '16px',
    boxSizing: 'border-box',
    animation: 'fadeIn 0.3s ease-out'
  };
  
  Object.assign(overlay.style, overlayStyles);
  
  // Create modal content with glassmorphism effect
  const modal = document.createElement('div');
  const modalStyles = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '480px',
    width: '100%',
    maxHeight: '90vh',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    textAlign: 'center',
    boxSizing: 'border-box',
    transform: 'scale(0.9)',
    animation: 'modalSlideIn 0.3s ease-out forwards',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  };
  
  Object.assign(modal.style, modalStyles);
  
  // Create warning icon with animated pulse
  const iconContainer = document.createElement('div');
  const iconStyles = {
    width: '64px',
    height: '64px',
    margin: '0 auto 24px',
    backgroundColor: '#fee2e2',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse 2s infinite'
  };
  Object.assign(iconContainer.style, iconStyles);
  
  iconContainer.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5">
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  // Create title
  const title = document.createElement('h3');
  title.textContent = 'Delete Practice';
  const titleStyles = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 16px 0',
    lineHeight: '1.3'
  };
  Object.assign(title.style, titleStyles);
  
  // Create description
  const description = document.createElement('div');
  description.innerHTML = `
    <p style="font-size: 16px; color: #6b7280; margin: 0 0 8px 0; line-height: 1.5;">
      Are you sure you want to delete this practice?
    </p>
    <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 16px; border-radius: 12px; margin: 16px 0 24px 0; border: 1px solid #d1d5db;">
      <p style="font-size: 15px; font-weight: 600; color: #374151; margin: 0; word-break: break-word;">
        "${practiceDescription}"
      </p>
    </div>
    <p style="font-size: 14px; color: #ef4444; margin: 0; font-weight: 500;">
      ⚠️ This action cannot be undone
    </p>
  `;
  
  // Create button container
  const buttonContainer = document.createElement('div');
  const buttonContainerStyles = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '32px',
    flexWrap: 'wrap'
  };
  Object.assign(buttonContainer.style, buttonContainerStyles);
  
  // Create Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.id = 'cancel-delete';
  const cancelButtonStyles = {
    padding: '12px 24px',
    backgroundColor: '#f9fafb',
    color: '#374151',
    border: '2px solid #d1d5db',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '100px',
    fontFamily: 'inherit'
  };
  Object.assign(cancelButton.style, cancelButtonStyles);
  
  // Create Delete button
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.id = 'confirm-delete';
  const deleteButtonStyles = {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '100px',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
    fontFamily: 'inherit'
  };
  Object.assign(deleteButton.style, deleteButtonStyles);
  
  // Add hover effects
  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.backgroundColor = '#f3f4f6';
    cancelButton.style.borderColor = '#9ca3af';
    cancelButton.style.transform = 'translateY(-1px)';
  });
  
  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.backgroundColor = '#f9fafb';
    cancelButton.style.borderColor = '#d1d5db';
    cancelButton.style.transform = 'translateY(0)';
  });
  
  deleteButton.addEventListener('mouseenter', () => {
    deleteButton.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
    deleteButton.style.transform = 'translateY(-1px)';
    deleteButton.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)';
  });
  
  deleteButton.addEventListener('mouseleave', () => {
    deleteButton.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    deleteButton.style.transform = 'translateY(0)';
    deleteButton.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
  });
  
  // Assemble modal
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(deleteButton);
  
  modal.appendChild(iconContainer);
  modal.appendChild(title);
  modal.appendChild(description);
  modal.appendChild(buttonContainer);
  
  overlay.appendChild(modal);
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes modalSlideIn {
      from { 
        transform: scale(0.9) translateY(20px);
        opacity: 0;
      }
      to { 
        transform: scale(1) translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    @media (max-width: 480px) {
      #delete-confirmation-overlay > div {
        margin: 16px !important;
        padding: 24px !important;
        border-radius: 16px !important;
      }
      
      #delete-confirmation-overlay h3 {
        font-size: 20px !important;
      }
      
      #delete-confirmation-overlay button {
        flex: 1 !important;
        min-width: auto !important;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  
  // Add event listeners
  cancelButton.addEventListener('click', () => {
    overlay.style.animation = 'fadeOut 0.2s ease-out';
    modal.style.animation = 'modalSlideOut 0.2s ease-out';
    setTimeout(() => {
      if (overlay.parentElement) {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
      }
      if (onCancel) onCancel();
    }, 200);
  });
  
  deleteButton.addEventListener('click', () => {
    overlay.style.animation = 'fadeOut 0.2s ease-out';
    modal.style.animation = 'modalSlideOut 0.2s ease-out';
    setTimeout(() => {
      if (overlay.parentElement) {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
      }
      if (onConfirm) onConfirm();
    }, 200);
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.animation = 'fadeOut 0.2s ease-out';
      modal.style.animation = 'modalSlideOut 0.2s ease-out';
      setTimeout(() => {
        if (overlay.parentElement) {
          document.body.removeChild(overlay);
          document.head.removeChild(style);
        }
        if (onCancel) onCancel();
      }, 200);
    }
  });
  
  // Add exit animations
  const exitStyle = document.createElement('style');
  exitStyle.textContent = `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes modalSlideOut {
      from { 
        transform: scale(1) translateY(0);
        opacity: 1;
      }
      to { 
        transform: scale(0.9) translateY(20px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(exitStyle);
  
  // Keyboard support
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      cancelButton.click();
      document.removeEventListener('keydown', escapeHandler);
    }
  });
}

// Enhanced success/error notification with modern design
function showDeleteResultNotification(success, message) {
  const notification = document.createElement('div');
  notification.id = 'delete-notification-' + Date.now();
  
  const baseStyles = {
    position: 'fixed',
    top: '24px',
    right: '24px',
    padding: '16px 20px',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    zIndex: '10000',
    maxWidth: '400px',
    minWidth: '300px',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transform: 'translateX(400px)',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  };
  
  const successStyles = {
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    color: 'white',
    border: '1px solid rgba(16, 185, 129, 0.3)'
  };
  
  const errorStyles = {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    color: 'white',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  };
  
  Object.assign(notification.style, baseStyles);
  Object.assign(notification.style, success ? successStyles : errorStyles);
  
  const icon = success ? 
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
       <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="12" cy="12" r="10"/>
     </svg>` :
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
       <circle cx="12" cy="12" r="10"/>
       <line x1="15" y1="9" x2="9" y2="15"/>
       <line x1="9" y1="9" x2="15" y2="15"/>
     </svg>`;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="flex-shrink: 0; margin-top: 2px;">
        ${icon}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
          ${success ? 'Success!' : 'Error'}
        </div>
        <div style="font-size: 14px; opacity: 0.9; line-height: 1.4;">
          ${message}
        </div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; color: currentColor; cursor: pointer; padding: 4px; border-radius: 6px; opacity: 0.7; transition: opacity 0.2s;"
              onmouseover="this.style.opacity='1'"
              onmouseout="this.style.opacity='0.7'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Slide in animation
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto remove with slide out animation
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.transform = 'translateX(400px)';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 400);
    }
  }, 5000);
  
  // Mobile responsive positioning
  if (window.innerWidth <= 480) {
    notification.style.right = '16px';
    notification.style.left = '16px';
    notification.style.maxWidth = 'none';
    notification.style.minWidth = 'auto';
    notification.style.transform = 'translateY(-100px)';
    
    setTimeout(() => {
      notification.style.transform = 'translateY(0)';
    }, 100);
    
    // Update auto-remove for mobile
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.transform = 'translateY(-100px)';
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 400);
      }
    }, 5000);
  }
}

// Function to remove practice from UI with smooth animation
function removePracticeFromUI(submissionId, categoryId, practiceIndex) {
  const practiceElement = document.querySelector(`[data-practice-index="${practiceIndex}"][data-category-id="${categoryId}"]`);
  if (practiceElement) {
    practiceElement.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    practiceElement.style.transform = 'translateX(-100%)';
    practiceElement.style.opacity = '0';
    practiceElement.style.maxHeight = practiceElement.offsetHeight + 'px';
    
    setTimeout(() => {
      practiceElement.style.maxHeight = '0';
      practiceElement.style.paddingTop = '0';
      practiceElement.style.paddingBottom = '0';
      practiceElement.style.marginTop = '0';
      practiceElement.style.marginBottom = '0';
    }, 200);
    
    setTimeout(() => {
      if (practiceElement.parentElement) {
        practiceElement.remove();
      }
    }, 600);
  }
  
  // Update category header counts
  const categoryElement = document.querySelector(`[data-category-id="${categoryId}"]`);
  if (categoryElement) {
    const practiceCountElement = categoryElement.querySelector('.practice-count');
    if (practiceCountElement) {
      const currentCount = parseInt(practiceCountElement.textContent) || 0;
      const newCount = Math.max(0, currentCount - 1);
      practiceCountElement.textContent = newCount;
      
      // Add a subtle animation to the count change
      practiceCountElement.style.transform = 'scale(1.2)';
      practiceCountElement.style.transition = 'transform 0.2s ease';
      setTimeout(() => {
        practiceCountElement.style.transform = 'scale(1)';
      }, 200);
    }
  }
}

// Main delete function with enhanced UX
window.deletePractice = async function(submissionId, categoryId, practiceIndex, practiceDescription = 'this practice') {
  const user = auth.currentUser;
  if (!user) {
    showDeleteResultNotification(false, 'Please log in to delete practices');
    return;
  }
  
  // Show confirmation dialog
  showDeleteConfirmationDialog(
    practiceDescription,
    async () => {
      // User confirmed deletion
      try {
        // Remove from UI immediately for better UX
        removePracticeFromUI(submissionId, categoryId, practiceIndex);
        
        // Get the current category document from Firestore
        const categoryRef = db.collection("users")
          .doc(user.uid)
          .collection("practice_submissions")
          .doc(submissionId)
          .collection("categories")
          .doc(categoryId);
          
        const categoryDoc = await categoryRef.get();
        if (!categoryDoc.exists) {
          throw new Error('Category not found');
        }
        
        const categoryData = categoryDoc.data();
        const practices = categoryData.practices || [];
        
        if (practiceIndex < 0 || practiceIndex >= practices.length) {
          throw new Error('Invalid practice index');
        }
        
        // Store the points of the practice being deleted
        const deletedPracticePoints = practices[practiceIndex].points || 0;
        
        // Remove the practice
        practices.splice(practiceIndex, 1);
        
        let categoryDeleted = false;
        
        if (practices.length === 0) {
          // Delete the entire category
          await categoryRef.delete();
          await database.ref(`users/${user.uid}/practice_submissions/${submissionId}/categories/${categoryId}`).remove();
          categoryDeleted = true;
        } else {
          // Update category
          const totalPoints = practices.reduce((sum, p) => sum + (p.points || 0), 0);
          
          const updatedCategoryData = {
            practices: practices,
            totalPoints: totalPoints,
            totalPractices: practices.length,
            lastModified: firebase.firestore.Timestamp.now()
          };
          
          await categoryRef.update(updatedCategoryData);
          await database.ref(`users/${user.uid}/practice_submissions/${submissionId}/categories/${categoryId}`).update({
            practices: practices,
            totalPoints: totalPoints,
            totalPractices: practices.length,
            lastModified: firebase.database.ServerValue.TIMESTAMP
          });
        }
        
        // Update submission totals and metadata
        await updateSubmissionAfterDeletion(submissionId, user.uid, deletedPracticePoints, categoryDeleted);
        
        // Update user metadata
        await updateUserMetadataAfterDeletion(user.uid, deletedPracticePoints);
        
        // Show success notification
        showDeleteResultNotification(true, categoryDeleted ? 
          'Practice deleted successfully! Category removed as it had no remaining practices.' :
          'Practice deleted successfully!'
        );
        
        // Refresh data and UI
        if (typeof fetchUserSubmissions === 'function') {
          await fetchUserSubmissions(user.uid);
        }
        
        // Handle modal refresh
        if (typeof currentViewingSubmission !== 'undefined' && currentViewingSubmission) {
          const updatedSubmission = typeof allSubmissions !== 'undefined' ? 
            allSubmissions.find(s => s.id === submissionId) : null;
          
          if (updatedSubmission && updatedSubmission.categories && updatedSubmission.categories.length > 0) {
            if (typeof showSubmissionDetailsModal === 'function') {
              showSubmissionDetailsModal(updatedSubmission);
            }
          } else {
            if (typeof closeSubmissionDetailsModal === 'function') {
              closeSubmissionDetailsModal();
            }
          }
        }
        
        // Force UI refresh
        if (typeof refreshDashboard === 'function') {
          refreshDashboard();
        }
        
      } catch (error) {
        console.error('Error deleting practice:', error);
        showDeleteResultNotification(false, 'Failed to delete practice. Please try again.');
        
        // Refresh to restore original state
        if (typeof fetchUserSubmissions === 'function') {
          await fetchUserSubmissions(user.uid);
        }
      }
    },
    () => {
      // User cancelled
      console.log('Practice deletion cancelled by user');
    }
  );
};

// Helper function to update submission after deletion
async function updateSubmissionAfterDeletion(submissionId, userId, deletedPoints, categoryWasDeleted) {
  try {
    const submissionRef = db.collection("users")
      .doc(userId)
      .collection("practice_submissions")
      .doc(submissionId);
      
    const submissionDoc = await submissionRef.get();
    if (!submissionDoc.exists) {
      throw new Error('Submission document not found');
    }
    
    const submissionData = submissionDoc.data();
    
    // Get remaining categories
    const categoriesSnapshot = await db.collection("users")
      .doc(userId)
      .collection("practice_submissions")
      .doc(submissionId)
      .collection("categories")
      .get();
    
    let newTotalPoints = 0;
    let newTotalPractices = 0;
    const newTotalCategories = categoriesSnapshot.size;
    
    categoriesSnapshot.forEach(doc => {
      const catData = doc.data();
      newTotalPoints += catData.totalPoints || 0;
      newTotalPractices += catData.totalPractices || 0;
    });
    
    // Calculate new user totals
    const currentUserTotalPoints = submissionData.userTotalPoints || 0;
    const currentUserTotalPractices = submissionData.userTotalPractices || 0;
    const newUserTotalPoints = Math.max(0, currentUserTotalPoints - deletedPoints);
    const newUserTotalPractices = Math.max(0, currentUserTotalPractices - 1);
    
    const updatedSubmissionData = {
      totalPoints: newTotalPoints,
      totalPractices: newTotalPractices,
      totalCategories: newTotalCategories,
      userTotalPoints: newUserTotalPoints,
      userTotalPractices: newUserTotalPractices,
      lastModified: firebase.firestore.Timestamp.now()
    };
    
    // Update both databases
    await submissionRef.update(updatedSubmissionData);
    await database.ref(`users/${userId}/practice_submissions/${submissionId}`).update({
      totalPoints: newTotalPoints,
      totalPractices: newTotalPractices,
      totalCategories: newTotalCategories,
      userTotalPoints: newUserTotalPoints,
      userTotalPractices: newUserTotalPractices,
      lastModified: firebase.database.ServerValue.TIMESTAMP
    });
    
  } catch (error) {
    console.error('Error updating submission after deletion:', error);
    throw error;
  }
}

// Helper function to update user metadata after deletion
async function updateUserMetadataAfterDeletion(userId, deletedPoints) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentTotalPoints = userData.totalPoints || 0;
      const currentTotalPractices = userData.totalPractices || 0;
      
      const newTotalPoints = Math.max(0, currentTotalPoints - deletedPoints);
      const newTotalPractices = Math.max(0, currentTotalPractices - 1);
      
      await userRef.update({
        totalPoints: newTotalPoints,
        totalPractices: newTotalPractices,
        lastModified: firebase.firestore.Timestamp.now()
      });
      
      await database.ref(`users/${userId}`).update({
        totalPoints: newTotalPoints,
        totalPractices: newTotalPractices,
        lastModified: firebase.database.ServerValue.TIMESTAMP
      });
    }
    
  } catch (error) {
    console.error('Error updating user metadata after deletion:', error);
    throw error;
  }
}  
    // ───────────────────────────────────────────────────────────
    // 10) FILTER SETUP
    // ───────────────────────────────────────────────────────────
    function setupFilters(data) {
      const practiceFilter = document.getElementById('practiceFilter');
      const dateRangeStart = document.getElementById('dateRangeStart');
      const dateRangeEnd = document.getElementById('dateRangeEnd');
      
      // Clear existing options except "All Practices"
      practiceFilter.innerHTML = '<option value="all">All Categories</option>';
      
      // Populate category types
      const categoryTypes = new Set();
      data.forEach(submission => {
        submission.categories.forEach(category => {
          categoryTypes.add(category.name);
        });
      });
      
      Array.from(categoryTypes).sort().forEach(categoryName => {
        const option = document.createElement('option');
        option.value = categoryName;
        option.textContent = categoryName;
        practiceFilter.appendChild(option);
      });
      
      // Set date range limits
      if (data.length > 0) {
        const dates = data.map(submission => submission.date).sort();
        const oldestDate = dates[0];
        const newestDate = dates[dates.length - 1];
        
        dateRangeStart.min = oldestDate;
        dateRangeStart.max = newestDate;
        dateRangeEnd.min = oldestDate;
        dateRangeEnd.max = newestDate;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        dateRangeStart.value = thirtyDaysAgoStr > oldestDate ? thirtyDaysAgoStr : oldestDate;
        dateRangeEnd.value = newestDate;
      }
      
      // Add event listeners
      practiceFilter.addEventListener('change', applyFilters);
      dateRangeStart.addEventListener('change', applyFilters);
      dateRangeEnd.addEventListener('change', applyFilters);
      
      function applyFilters() {
        const filterType = practiceFilter.value;
        const startDate = dateRangeStart.value || null;
        const endDate = dateRangeEnd.value || null;
        
        populateSubmissionsTimeline(allSubmissions, filterType, startDate, endDate);
      }
      
      // Apply initial filters
      applyFilters();
    }
    
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