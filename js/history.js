document.addEventListener('DOMContentLoaded', function() {
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
      // Show error message to user
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
        fetchUserPracticeHistory(user.uid);
      } else {
        console.log("No user logged in");
        // Show login prompt
        document.querySelector('.history-container').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('emptyState').innerHTML = `
          <img src="/api/placeholder/150/150" alt="Login required">
          <h3>Login Required</h3>
          <p>Please login to view your practice history.</p>
          <a href="login.html" class="start-btn">Login</a>
        `;
      }
    });
    
    // ───────────────────────────────────────────────────────────
    // 4) FETCH USER PRACTICE DATA
    // ───────────────────────────────────────────────────────────
    function fetchUserPracticeHistory(userId) {
      const userSubmissionsRef = db.collection("users").doc(userId).collection("task_submissions");
      
      userSubmissionsRef.orderBy("timestamp", "desc").get()
        .then(snapshot => {
          if (snapshot.empty) {
            console.log("No practice history found");
            document.querySelector('.history-container').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
            return;
          }
          
          const practiceHistory = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            
            // Format the practice data to match our application structure
            const formattedPractice = {
              id: doc.id,
              date: data.date,
              type: data.category,
              details: data.practices.map(p => p.name).join(", "),
              duration: calculateEstimatedDuration(data.practices),
              practiceItems: data.practices.map(p => p.name)
            };
            
            practiceHistory.push(formattedPractice);
          });
          
          // Initialize the page with the practice data
          if (practiceHistory.length === 0) {
            document.querySelector('.history-container').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
          } else {
            initializePage(practiceHistory);
          }
        })
        .catch(error => {
          console.error("Error fetching practice history:", error);
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
        });
    }
    
    // Helper function to estimate practice duration based on practices
    function calculateEstimatedDuration(practices) {
      // Simple estimation: 
      // - Putting/Chipping: 20 min per practice
      // - Irons & Tee Shot: 30 min per practice
      // - On The Course: 45-120 min depending on points
      // - Others: 30 min per practice
      
      let totalMinutes = 0;
      
      practices.forEach(practice => {
        const name = practice.name.toLowerCase();
        const points = practice.points || 1;
        
        if (name.includes('putt') || name.includes('chip')) {
          totalMinutes += 20 * points;
        } else if (name.includes('iron') || name.includes('driver') || name.includes('fairway')) {
          totalMinutes += 30 * points;
        } else if (name.includes('otc')) {
          // On the course practices
          if (name.includes('full18')) {
            totalMinutes += 240; // 4 hours for full 18
          } else if (name.includes('quick9')) {
            totalMinutes += 120; // 2 hours for 9 holes
          } else {
            totalMinutes += 45 * points;
          }
        } else {
          totalMinutes += 30 * points;
        }
      });
      
      // Ensure minimum duration of 15 minutes
      return Math.max(15, totalMinutes);
    }
    
    // ───────────────────────────────────────────────────────────
    // 5) INITIALIZE PAGE FUNCTIONS
    // ───────────────────────────────────────────────────────────
    function initializePage(data) {
      updateStats(data);
      populateMostPracticed(data);
      populateTimeline(data);
      setupFilters(data);
      setupExportButtons(data);
    }
    
    function updateStats(data) {
      // Update total practices
      document.getElementById('totalPractices').textContent = data.length;
      
      // Calculate current streak (consecutive days)
      let currentStreak = calculateCurrentStreak(data);
      document.getElementById('currentStreak').textContent = currentStreak;
      
      // Calculate longest streak
      let longestStreak = calculateLongestStreak(data);
      document.getElementById('longestStreak').textContent = longestStreak;
    }
    
    function calculateCurrentStreak(data) {
      // This is a simplified streak calculation
      if (data.length === 0) return 0;
      
      // Sort data by date (newest first)
      const sortedData = [...data].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      );
      
      let streak = 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if most recent practice was today or yesterday
      const mostRecentDate = new Date(sortedData[0].date);
      const dayDiff = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff > 1) {
        return 0; // Streak broken if last practice was before yesterday
      }
      
      // Count consecutive days
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
      
      // Sort by date (oldest first)
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
      
      // Count practices by type
      const practiceCount = {};
      data.forEach(practice => {
        practiceCount[practice.type] = (practiceCount[practice.type] || 0) + 1;
      });
      
      // Convert to array and sort by count
      const sortedPractices = Object.entries(practiceCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3); // Get top 3
      
      // Calculate total for percentages
      const totalPractices = data.length;
      
      // Only show practices done over 4 days
      const practicesToShow = sortedPractices.filter(p => p[1] >= 2); // Changed from 4 to 2 for easier testing
      
      if (practicesToShow.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 20px;">
            <p>No practice has been done for more than 2 days yet.</p>
          </div>
        `;
        return;
      }
      
      // Create progress bars
      practicesToShow.forEach(([type, count]) => {
        const percentage = Math.round((count / totalPractices) * 100);
        
        const practiceEl = document.createElement('div');
        practiceEl.className = 'practice-progress';
        practiceEl.innerHTML = `
          <h3>${type}</h3>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${percentage}%"></div>
            <span class="progress-text">${count} days (${percentage}%)</span>
          </div>
        `;
        
        container.appendChild(practiceEl);
      });
    }
    
    function populateTimeline(data, filterType = 'all', startDate = null, endDate = null) {
      const container = document.getElementById('timelineContainer');
      container.innerHTML = '';
      
      // Filter data based on parameters
      let filteredData = [...data];
      
      if (filterType !== 'all') {
        filteredData = filteredData.filter(item => item.type === filterType);
      }
      
      if (startDate) {
        const start = new Date(startDate);
        filteredData = filteredData.filter(item => new Date(item.date) >= start);
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include the entire end day
        filteredData = filteredData.filter(item => new Date(item.date) <= end);
      }
      
      // Sort by date (newest first)
      filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (filteredData.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 20px;">
            <p>No practice sessions found for the selected filters.</p>
          </div>
        `;
        return;
      }
      
      // Create timeline items
      filteredData.forEach(practice => {
        const date = new Date(practice.date);
        const formattedDate = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        // Create practice items tags
        const practiceItemsHTML = practice.practiceItems.map(item => 
          `<span class="practice-tag">${item}</span>`
        ).join('');
        
        timelineItem.innerHTML = `
          <div class="timeline-date">${formattedDate}</div>
          <div class="timeline-content">
            <h3>${practice.type}</h3>
            <p>${practice.details}</p>
            <p>Duration: ${practice.duration} minutes</p>
            <div class="practice-items">
              ${practiceItemsHTML}
            </div>
          </div>
        `;
        
        container.appendChild(timelineItem);
      });
    }
    
    function setupFilters(data) {
      const practiceFilter = document.getElementById('practiceFilter');
      const dateRangeStart = document.getElementById('dateRangeStart');
      const dateRangeEnd = document.getElementById('dateRangeEnd');
      
      // Populate practice types
      const practiceTypes = [...new Set(data.map(item => item.type))];
      practiceTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        practiceFilter.appendChild(option);
      });
      
      // Set date range limits
      if (data.length > 0) {
        // Sort dates
        const dates = data.map(item => item.date).sort();
        const oldestDate = dates[0];
        const newestDate = dates[dates.length - 1];
        
        // Set min/max for date inputs
        dateRangeStart.min = oldestDate;
        dateRangeStart.max = newestDate;
        dateRangeEnd.min = oldestDate;
        dateRangeEnd.max = newestDate;
        
        // Default to last 30 days
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
        
        populateTimeline(data, filterType, startDate, endDate);
      }
      
      // Apply initial filters
      applyFilters();
    }
    
    function setupExportButtons(data) {
      const exportCsvBtn = document.getElementById('exportCsvBtn');
      const printHistoryBtn = document.getElementById('printHistoryBtn');
      
      // Export to CSV functionality
      exportCsvBtn.addEventListener('click', function() {
        const csvContent = convertToCSV(data);
        downloadCSV(csvContent, 'practice-history.csv');
      });
      
      // Print functionality
      printHistoryBtn.addEventListener('click', function() {
        window.print();
      });
    }
    
    function convertToCSV(data) {
      // CSV header
      const header = ['Date', 'Type', 'Details', 'Duration (min)', 'Practice Items'];
      
      // Format rows
      const rows = data.map(item => [
        item.date,
        item.type,
        item.details,
        item.duration,
        item.practiceItems.join(', ')
      ]);
      
      // Combine header and rows
      const csvContent = [
        header.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      return csvContent;
    }
    
    function downloadCSV(content, filename) {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  });