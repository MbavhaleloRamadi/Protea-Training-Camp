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
      
      let categoriesHTML = '';
      submission.categories.forEach(category => {
        let practicesHTML = '';
        category.practices.forEach((practice, index) => {
          practicesHTML += `
            <div class="practice-item">
              <div class="practice-info">
                <h5>${practice.name || 'Unnamed Practice'}</h5>
                <p>${practice.description || 'No description'}</p>
                <div class="practice-meta">
                  <span>Points: ${practice.points || 0}</span>
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
      
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
    
    window.closeSubmissionDetailsModal = function() {
      const modal = document.getElementById('submissionDetailsModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      currentViewingSubmission = null;
    };
    
    // ───────────────────────────────────────────────────────────
    // 8) EDIT PRACTICE FUNCTIONALITY
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
                <label for="editPracticeName">Practice Name</label>
                <input type="text" id="editPracticeName" value="${practice.name || ''}" required>
              </div>
              
              <div class="form-group">
                <label for="editPracticeDescription">Description</label>
                <textarea id="editPracticeDescription" rows="3">${practice.description || ''}</textarea>
              </div>
              
              <div class="form-group">
                <label for="editPracticePoints">Points</label>
                <input type="number" id="editPracticePoints" value="${practice.points || 0}" min="0" required>
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
      
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
    
    window.closeEditPracticeModal = function() {
      const modal = document.getElementById('editPracticeModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      currentEditingSubmissionId = null;
      currentEditingCategoryId = null;
      currentEditingPracticeId = null;
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
      
      try {
        const updatedPractice = {
          name: document.getElementById('editPracticeName').value,
          description: document.getElementById('editPracticeDescription').value,
          points: parseInt(document.getElementById('editPracticePoints').value) || 0,
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
    // 9) DELETE PRACTICE FUNCTIONALITY
    // ───────────────────────────────────────────────────────────
    window.deletePractice = async function(submissionId, categoryId, practiceIndex) {
      if (!confirm('Are you sure you want to delete this practice? This action cannot be undone.')) {
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        showNotification('Please log in to delete practices', 'error');
        return;
      }
      
      try {
        // Get the current category document
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
        
        // Remove the practice
        practices.splice(practiceIndex, 1);
        
        if (practices.length === 0) {
          // If no practices left, delete the entire category
          await categoryRef.delete();
          showNotification('Practice deleted. Category removed as it had no remaining practices.', 'success');
        } else {
          // Recalculate totals
          const totalPoints = practices.reduce((sum, p) => sum + (p.points || 0), 0);
          
          // Update the category document
          await categoryRef.update({
            practices: practices,
            totalPoints: totalPoints,
            totalPractices: practices.length,
            lastModified: firebase.firestore.Timestamp.now()
          });
          
          showNotification('Practice deleted successfully!', 'success');
        }
        
        // Refresh the data
        await fetchUserSubmissions(user.uid);
        
        // Reopen the submission details if it was open
        if (currentViewingSubmission) {
          const updatedSubmission = allSubmissions.find(s => s.id === submissionId);
          if (updatedSubmission && updatedSubmission.categories.length > 0) {
            showSubmissionDetailsModal(updatedSubmission);
          } else {
            closeSubmissionDetailsModal();
          }
        }
        
      } catch (error) {
        console.error('Error deleting practice:', error);
        showNotification('Error deleting practice. Please try again.', 'error');
      }
    };
    
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