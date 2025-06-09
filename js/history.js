document.addEventListener('DOMContentLoaded', function() {
    let allPracticeEntries = [];
    let filteredEntries = [];
    let currentEditingId = null;
  
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
        fetchUserPracticeHistory(user.uid);
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
            console.log("Processing doc:", doc.id, data);
            
            const practices = data.practices || [];
            
            // Format the practice data
            const formattedPractice = {
              id: doc.id,
              date: data.date || new Date().toISOString().split('T')[0],
              type: data.category || "Unknown",
              details: practices.map(p => p.name || p.description || "Unnamed practice").join(", "),
              duration: calculateEstimatedDuration(practices),
              practiceItems: practices.map(p => p.name || p.description || "Unnamed practice"),
              // Add additional fields for editing
              description: data.description || "",
              notes: data.notes || "",
              score: data.score || "",
              location: data.location || "",
              timestamp: data.timestamp || new Date()
            };
            
            practiceHistory.push(formattedPractice);
          });
          
          if (practiceHistory.length === 0) {
            document.querySelector('.history-container').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
          } else {
            allPracticeEntries = practiceHistory;
            filteredEntries = [...allPracticeEntries];
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
    
    // Helper function to estimate practice duration
    function calculateEstimatedDuration(practices) {
      let totalMinutes = 0;
      
      if (!practices || !Array.isArray(practices)) {
        console.warn("Invalid practices data:", practices);
        return 30;
      }
      
      practices.forEach(practice => {
        if (!practice || !practice.name && !practice.description) {
          console.warn("Invalid practice item:", practice);
          totalMinutes += 30;
          return;
        }
        
        const name = (practice.name || practice.description || "").toLowerCase();
        const points = practice.points || 1;
        
        if (name.includes('putt') || name.includes('chip')) {
          totalMinutes += 20 * points;
        } else if (name.includes('iron') || name.includes('driver') || name.includes('fairway')) {
          totalMinutes += 30 * points;
        } else if (name.includes('otc')) {
          if (name.includes('full18')) {
            totalMinutes += 240;
          } else if (name.includes('quick9')) {
            totalMinutes += 120;
          } else {
            totalMinutes += 45 * points;
          }
        } else {
          totalMinutes += 30 * points;
        }
      });
      
      return Math.max(15, totalMinutes);
    }
    
    // ───────────────────────────────────────────────────────────
    // 5) INITIALIZE PAGE FUNCTIONS
    // ───────────────────────────────────────────────────────────
    function initializePage(data) {
      updateStats(data);
      populateMostPracticed(data);
      populateTimelineWithActions(data);
      setupFilters(data);
      setupExportButtons(data);
    }
    
    function updateStats(data) {
      document.getElementById('totalPractices').textContent = data.length;
      let currentStreak = calculateCurrentStreak(data);
      document.getElementById('currentStreak').textContent = currentStreak;
      let longestStreak = calculateLongestStreak(data);
      document.getElementById('longestStreak').textContent = longestStreak;
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
      
      const practiceCount = {};
      data.forEach(practice => {
        practiceCount[practice.type] = (practiceCount[practice.type] || 0) + 1;
      });
      
      const sortedPractices = Object.entries(practiceCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      const totalPractices = data.length;
      const practicesToShow = sortedPractices.filter(p => p[1] >= 2);
      
      if (practicesToShow.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 20px;">
            <p>No practice has been done for more than 2 days yet.</p>
          </div>
        `;
        return;
      }
      
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
    
    // ───────────────────────────────────────────────────────────
    // 6) ENHANCED TIMELINE WITH EDIT/DELETE ACTIONS
    // ───────────────────────────────────────────────────────────
    function populateTimelineWithActions(data, filterType = 'all', startDate = null, endDate = null) {
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
        end.setHours(23, 59, 59);
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
      
      // Create timeline items with edit/delete buttons
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
        timelineItem.setAttribute('data-entry-id', practice.id);
        
        // Create practice items tags
        const practiceItemsHTML = practice.practiceItems.map(item => 
          `<span class="practice-tag">${item}</span>`
        ).join('');
        
        timelineItem.innerHTML = `
          <div class="timeline-date">${formattedDate}</div>
          <div class="timeline-content">
            <div class="timeline-header">
              <h3>${practice.type}</h3>
              <div class="timeline-actions">
                <button class="edit-btn" onclick="editEntry('${practice.id}')" title="Edit Entry">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteEntry('${practice.id}')" title="Delete Entry">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <p>${practice.details}</p>
            ${practice.description ? `<p><strong>Description:</strong> ${practice.description}</p>` : ''}
            ${practice.notes ? `<p><strong>Notes:</strong> ${practice.notes}</p>` : ''}
            <div class="timeline-stats">
              <span>Duration: ${practice.duration} minutes</span>
              ${practice.score ? `<span>Score: ${practice.score}</span>` : ''}
              ${practice.location ? `<span>Location: ${practice.location}</span>` : ''}
            </div>
            <div class="practice-items">
              ${practiceItemsHTML}
            </div>
          </div>
        `;
        
        container.appendChild(timelineItem);
      });
    }
    
    // ───────────────────────────────────────────────────────────
    // 7) EDIT FUNCTIONALITY
    // ───────────────────────────────────────────────────────────
    window.editEntry = function(entryId) {
      const entry = allPracticeEntries.find(e => e.id === entryId);
      if (!entry) {
        showNotification('Entry not found', 'error');
        return;
      }
      
      currentEditingId = entryId;
      showEditModal(entry);
    };
    
    function showEditModal(entry) {
      const modal = document.getElementById('editModal');
      
      // Populate modal fields
      document.getElementById('editPracticeType').value = entry.type || '';
      document.getElementById('editDescription').value = entry.description || '';
      document.getElementById('editScore').value = entry.score || '';
      document.getElementById('editDuration').value = entry.duration || '';
      document.getElementById('editLocation').value = entry.location || '';
      document.getElementById('editNotes').value = entry.notes || '';
      document.getElementById('editDate').value = entry.date || '';
      
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
    
    window.closeEditModal = function() {
      const modal = document.getElementById('editModal');
      modal.classList.add('hidden');
      modal.style.display = 'none';
      currentEditingId = null;
    };
    
    window.saveEditedEntry = async function() {
      if (!currentEditingId) return;
      
      const user = auth.currentUser;
      if (!user) {
        showNotification('Please log in to edit entries', 'error');
        return;
      }
      
      try {
        const updatedData = {
          category: document.getElementById('editPracticeType').value,
          description: document.getElementById('editDescription').value,
          score: document.getElementById('editScore').value,
          duration: parseInt(document.getElementById('editDuration').value) || null,
          location: document.getElementById('editLocation').value,
          notes: document.getElementById('editNotes').value,
          date: document.getElementById('editDate').value,
          lastModified: firebase.firestore.Timestamp.now()
        };
        
        // Update in Firestore
        await db.collection("users")
          .doc(user.uid)
          .collection("task_submissions")
          .doc(currentEditingId)
          .update(updatedData);
        
        showNotification('Entry updated successfully!', 'success');
        closeEditModal();
        
        // Refresh the data
        fetchUserPracticeHistory(user.uid);
        
      } catch (error) {
        console.error('Error updating entry:', error);
        showNotification('Error updating entry. Please try again.', 'error');
      }
    };
    
    // ───────────────────────────────────────────────────────────
    // 8) DELETE FUNCTIONALITY
    // ───────────────────────────────────────────────────────────
    window.deleteEntry = async function(entryId) {
      if (!confirm('Are you sure you want to delete this practice entry? This action cannot be undone.')) {
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        showNotification('Please log in to delete entries', 'error');
        return;
      }
      
      try {
        // Delete from Firestore
        await db.collection("users")
          .doc(user.uid)
          .collection("task_submissions")
          .doc(entryId)
          .delete();
        
        showNotification('Entry deleted successfully!', 'success');
        
        // Refresh the data
        fetchUserPracticeHistory(user.uid);
        
      } catch (error) {
        console.error('Error deleting entry:', error);
        showNotification('Error deleting entry. Please try again.', 'error');
      }
    };
    
    // ───────────────────────────────────────────────────────────
    // 9) FILTER SETUP
    // ───────────────────────────────────────────────────────────
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
        const dates = data.map(item => item.date).sort();
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
        
        populateTimelineWithActions(allPracticeEntries, filterType, startDate, endDate);
      }
      
      // Apply initial filters
      applyFilters();
    }
    
    // ───────────────────────────────────────────────────────────
    // 10) EXPORT FUNCTIONALITY
    // ───────────────────────────────────────────────────────────
    function setupExportButtons(data) {
      const exportCsvBtn = document.getElementById('exportCsvBtn');
      const printHistoryBtn = document.getElementById('printHistoryBtn');
      
      exportCsvBtn.addEventListener('click', function() {
        const csvContent = convertToCSV(data);
        downloadCSV(csvContent, 'practice-history.csv');
      });
      
      printHistoryBtn.addEventListener('click', function() {
        window.print();
      });
    }
    
    function convertToCSV(data) {
      const header = ['Date', 'Type', 'Details', 'Duration (min)', 'Practice Items', 'Score', 'Location', 'Notes'];
      
      const rows = data.map(item => [
        item.date,
        item.type,
        item.details,
        item.duration,
        item.practiceItems.join(', '),
        item.score || '',
        item.location || '',
        item.notes || ''
      ]);
      
      const csvContent = [
        header.join(','),
        ...rows.map(row => row.map(field => `"${field}"`).join(','))
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