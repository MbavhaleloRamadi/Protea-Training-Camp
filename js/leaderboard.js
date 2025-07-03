document.addEventListener("DOMContentLoaded", () => {
    // ───────────────────────────────────────────────────────────
    // DOM Elements - Define all DOM elements at the start
    // ───────────────────────────────────────────────────────────
    const elements = {
      // Loader elements
      loader: document.querySelector(".loader-overlay"),
      
      // Leaderboard elements
      leaderboardContainer: document.getElementById("leaderboardData"),
    };

    // Create and inject the modal for player history
    createPlayerHistoryModal();
  
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
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // Initialize Firebase services
        auth = firebase.auth();
        dbFirestore = firebase.firestore(); // Firestore is needed now
        dbRealtime = firebase.database();
        
        // Auth state changes
        auth.onAuthStateChanged(handleAuthStateChanged);
      } else {
        console.error("Firebase SDK not found. Make sure it's included before this script.");
        showError("Firebase SDK not found. Please refresh or contact support.");
        return; // halt further setup
      }
    } catch (error) {
      console.error("Firebase initialization error:", error);
      showError("Could not initialize Firebase. Please refresh or contact support.");
      return;
    }
  
    // ───────────────────────────────────────────────────────────
    // 3) AUTH STATE CHANGE HANDLER
    // ───────────────────────────────────────────────────────────
    function handleAuthStateChanged(user) {
      if (user) {
        console.log("User is logged in");
        // Initialize the leaderboard
        initializeLeaderboard();
      } else {
        console.log("User is not logged in, redirecting to login");
        window.location.href = "login.html";
      }
    }
  
    // ───────────────────────────────────────────────────────────
    // 4) LEADERBOARD INITIALIZATION
    // ───────────────────────────────────────────────────────────
    function initializeLeaderboard() {
      if (!elements.leaderboardContainer) return;
  
      // Display loading state
      showLoading();
  
      // Setup real-time listener for all users
      setupRealtimeLeaderboard();
      
      // Add event listener for clicking on player names
      setupPlayerHistoryClickListener();
    }
  
    function showLoading() {
      if (elements.leaderboardContainer) {
        elements.leaderboardContainer.innerHTML = `
          <div class="loading-data">
            <div class="loading-spinner"></div>
            <p>Loading leaderboard data...</p>
          </div>
        `;
      }
    }
  
    function showError(message) {
      if (elements.leaderboardContainer) {
        elements.leaderboardContainer.innerHTML = `
          <div class="error-message">
            <p>${escapeHtml(message)}</p>
          </div>
        `;
      }
    }
  
    // ───────────────────────────────────────────────────────────
    // 5) REALTIME LEADERBOARD SETUP
    // ───────────────────────────────────────────────────────────
    function setupRealtimeLeaderboard() {
      // Use Realtime Database for live updates
      const usersRef = dbRealtime.ref("users");
      
      // Listen for value changes
      usersRef.on("value", (snapshot) => {
        try {
          if (!snapshot.exists()) {
            elements.leaderboardContainer.innerHTML = "<div class='no-data'>No leaderboard data available yet.</div>";
            return;
          }
          
          const usersData = snapshot.val();
          processLeaderboardData(usersData);
        } catch (error) {
          console.error("Error processing leaderboard data:", error);
          showError("Error loading leaderboard. Please refresh the page.");
        }
      }, (error) => {
        console.error("Database error:", error);
        showError("Database connection error. Please try again later.");
      });
    }
  
    // ───────────────────────────────────────────────────────────
    // SIMPLIFIED LEADERBOARD PROCESSING - Using totalPoints field from categories
    // ───────────────────────────────────────────────────────────
    function processLeaderboardData(usersData) {
      const leaderboardEntries = [];
      Object.keys(usersData).forEach(userId => {
        const userData = usersData[userId];
        if (!userData.username) return;
        
        let totalScore = 0;
        let roundsPlayed = 0;
        let latestSubmissionTime = 0;
        
        if (userData.practice_submissions) {
          Object.values(userData.practice_submissions).forEach(dailySubmission => {
             if (dailySubmission.categories) {
                 Object.values(dailySubmission.categories).forEach(category => {
                     if (!category.isDeleted) {
                         totalScore += category.totalPoints || 0;
                         roundsPlayed += category.totalPractices || 0;
                         if (category.submittedAt && category.submittedAt.timestamp > latestSubmissionTime) {
                             latestSubmissionTime = category.submittedAt.timestamp;
                         }
                     }
                 });
             }
          });
        }
        
        leaderboardEntries.push({
          userId: userId,
          name: userData.username,
          rawScore: totalScore,
          displayScore: roundsPlayed > 0 ? totalScore.toString() : "N/A",
          roundsPlayed: roundsPlayed,
          latestSubmissionTime: latestSubmissionTime
        });
      });
      
      leaderboardEntries.sort((a, b) => {
        if (a.roundsPlayed === 0 && b.roundsPlayed > 0) return 1;
        if (b.roundsPlayed === 0 && a.roundsPlayed > 0) return -1;
        if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
        return a.latestSubmissionTime - b.latestSubmissionTime;
      });
      
      renderLeaderboard(leaderboardEntries);
    }

    // ───────────────────────────────────────────────────────────
    // 7) RENDER LEADERBOARD - UPDATED FOR GOLF DISPLAY & CLICKABLE NAMES
    // ───────────────────────────────────────────────────────────
    function renderLeaderboard(entries) {
      elements.leaderboardContainer.innerHTML = "";
      const fragment = document.createDocumentFragment();
      
      if (entries.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "no-data";
        emptyMessage.textContent = "No leaderboard data available yet.";
        fragment.appendChild(emptyMessage);
      } else {
        entries.forEach((entry, index) => {
          const rank = index + 1;
          const row = createLeaderboardRow(rank, entry);
          fragment.appendChild(row);
        });
      }
      
      elements.leaderboardContainer.appendChild(fragment);
      
      if (elements.loader) {
        elements.loader.style.display = "none";
      }
    }
  
    // UPDATED to make names clickable
    function createLeaderboardRow(rank, entry) {
      const row = document.createElement("div");
      row.classList.add("leaderboard-row");
      
      if (rank <= 3) row.classList.add(`rank-${rank}`);
      
      const currentUser = auth.currentUser;
      if (currentUser && entry.userId === currentUser.uid) {
        row.classList.add("current-user");
      }
      
      // Make the name a clickable button
      row.innerHTML = `
        <div class="rank">${rank}</div>
        <div class="name">
          <button class="player-name-btn" data-userid="${entry.userId}" data-username="${escapeHtml(entry.name)}">
            ${escapeHtml(entry.name)}
          </button>
        </div>
        <div class="score">${entry.displayScore}</div>
      `;
      
      return row;
    }

    // ───────────────────────────────────────────────────────────
    // 8) NEW: PLAYER HISTORY MODAL FUNCTIONALITY
    // ───────────────────────────────────────────────────────────

    function createPlayerHistoryModal() {
        if (document.getElementById('playerHistoryModal')) return;

        const modalHTML = `
            <div class="modal-overlay hidden" id="playerHistoryModal">
                <div class="modal-container large-modal">
                    <div class="modal-header">
                        <h3 id="playerHistoryModalTitle">Player History</h3>
                        <button class="modal-close" id="playerHistoryModalCloseBtn" aria-label="Close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="playerHistoryModalBody">
                        </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listener to close button
        document.getElementById('playerHistoryModalCloseBtn').addEventListener('click', () => {
            document.getElementById('playerHistoryModal').classList.add('hidden');
        });
    }

    function setupPlayerHistoryClickListener() {
        elements.leaderboardContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.player-name-btn');
            if (button) {
                const userId = button.dataset.userid;
                const username = button.dataset.username;
                showPlayerHistoryModal(userId, username);
            }
        });
    }

    async function showPlayerHistoryModal(userId, username) {
        const modal = document.getElementById('playerHistoryModal');
        const modalTitle = document.getElementById('playerHistoryModalTitle');
        const modalBody = document.getElementById('playerHistoryModalBody');

        modalTitle.textContent = `${username}'s Submission History`;
        modalBody.innerHTML = `
            <div class="loading-placeholder">
                <div class="loading-spinner"></div>
                <p>Loading practice history...</p>
            </div>`;
        modal.classList.remove('hidden');

        try {
            const submissionsRef = dbFirestore.collection("users").doc(userId).collection("practice_submissions");
            const snapshot = await submissionsRef.orderBy("date", "desc").get();

            if (snapshot.empty) {
                modalBody.innerHTML = `<div class="no-data">No practice history found for this player.</div>`;
                return;
            }

            let allPractices = [];
            for (const doc of snapshot.docs) {
                const submissionData = doc.data();
                const submissionDate = submissionData.date;

                const categoriesSnapshot = await doc.ref.collection("categories").get();
                for (const catDoc of categoriesSnapshot.docs) {
                    const categoryData = catDoc.data();
                    if (categoryData.isDeleted) continue;

                    const practices = categoryData.practices || [];
                    practices.forEach(p => {
                        allPractices.push({
                            date: submissionDate,
                            name: p.name || 'Unnamed Practice',
                            points: p.isDoublePoints ? (p.points || 0) * 2 : (p.points || 0),
                            time: p.addedAt ? new Date(p.addedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                            isEdited: p.isEdited || !!p.lastModified
                        });
                    });
                }
            }
            
            // Group practices by date
            const groupedByDate = allPractices.reduce((acc, practice) => {
                (acc[practice.date] = acc[practice.date] || []).push(practice);
                return acc;
            }, {});

            // Generate HTML
            let historyHtml = '<div class="history-timeline-popup">';
            if (Object.keys(groupedByDate).length === 0) {
                 historyHtml += `<div class="no-data">No practice history found for this player.</div>`;
            } else {
                 for (const date in groupedByDate) {
                    historyHtml += `
                        <div class="timeline-day-group">
                            <h4 class="timeline-date-heading">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                            <ul class="practice-log-list">`;
                    
                    groupedByDate[date].forEach(p => {
                        historyHtml += `
                            <li class="practice-log-item">
                                <span class="log-time">${p.time}</span>
                                <span class="log-name">${escapeHtml(p.name)}</span>
                                <span class="log-points">${p.points} pts</span>
                                ${p.isEdited ? '<span class="log-edited" title="This practice was edited.">Edited</span>' : ''}
                            </li>`;
                    });

                    historyHtml += `</ul></div>`;
                }
            }
            historyHtml += '</div>';
            modalBody.innerHTML = historyHtml;

        } catch (error) {
            console.error("Error fetching player history:", error);
            modalBody.innerHTML = `<div class="error-message"><p>Could not load player history.</p></div>`;
        }
    }
  
    // ───────────────────────────────────────────────────────────
    // HELPER FUNCTIONS
    // ───────────────────────────────────────────────────────────
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
});