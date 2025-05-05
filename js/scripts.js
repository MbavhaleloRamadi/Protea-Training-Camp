document.addEventListener("DOMContentLoaded", function () {
  // Loader behavior
  const loader = document.querySelector(".loader-overlay");
  if (loader) {
    window.addEventListener("load", () => {
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.6s ease";
      setTimeout(() => {
        loader.style.display = "none";
        document.body.style.visibility = "visible";
      }, 600);
    });
  }

  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCLFOHGb5xaMSUtE_vgVO0aaY6MfLySeTs",
    authDomain: "protea-training-camp.firebaseapp.com",
    projectId: "protea-training-camp",
    storageBucket: "protea-training-camp.appspot.com", // ✅ Fixed
    messagingSenderId: "649833361697",
    appId: "1:649833361697:web:5c402a67872ca10fe30e60",
    measurementId: "G-K1HKHPG6HG"
  };

  // Initialize Firebase
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
  } else {
    console.error("Firebase not loaded.");
    return;
  }

  // Auth State Monitoring
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log("User is logged in");
    } else {
      console.log("User is not logged in");
    }
  });

  // Register Form Logic
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById("registerName").value;
      const email = document.getElementById("registerEmail").value;
      const password = document.getElementById("registerPassword").value;

      firebase.auth().createUserWithEmailAndPassword(email, password)
        .then(() => {
          alert("Registration successful!");
          window.location.href = "login.html";
        })
        .catch((error) => {
          alert("Registration failed: " + error.message);
        });
    });
  }

  // Login Form Logic
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPassword").value;

      firebase.auth().signInWithEmailAndPassword(email, password)
        .then(() => {
          window.location.href = "dashboard.html";
        })
        .catch((error) => {
          if (error.code === "auth/wrong-password") {
            alert("Incorrect password. Please try again.");
          } else {
            alert("Login failed: Please Register First.");
          }
        });
    });
  }

  // Fetch and render leaderboard
  const db = firebase.firestore();
  const leaderboardRef = db.collection("leaderboard").orderBy("score", "desc").limit(10);

  leaderboardRef.get().then((querySnapshot) => {
    const leaderboardDataContainer = document.getElementById("leaderboardData");
    if (!leaderboardDataContainer) return;

    let rank = 1;
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const playerRow = document.createElement("div");
      playerRow.classList.add("leaderboard-row");

      const rankDiv = document.createElement("div");
      rankDiv.classList.add("rank");
      rankDiv.textContent = rank++;

      const nameDiv = document.createElement("div");
      nameDiv.classList.add("name");
      nameDiv.textContent = data.name;

      const scoreDiv = document.createElement("div");
      scoreDiv.classList.add("score");
      scoreDiv.textContent = data.score;

      playerRow.append(rankDiv, nameDiv, scoreDiv);
      leaderboardDataContainer.appendChild(playerRow);
    });
  }).catch((error) => {
    console.error("Error fetching leaderboard data: ", error);
  });

  // Simulated user data (replace later with Firebase user profile)
  const user = {
    name: 'John Doe',
    todayScore: 45,
    weeklyScore: 300,
    allTimeScore: 1500,
    isAdmin: true
  };

  if (document.getElementById('user-name')) {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('today-score-value').innerText = user.todayScore;
    document.getElementById('weekly-score-value').innerText = user.weeklyScore;
    document.getElementById('all-time-score-value').innerText = user.allTimeScore;

    if (user.isAdmin) {
      document.getElementById('admin-button').style.display = 'inline-block';
    }
  }

  // Jotform Firebase Integration
document.addEventListener("DOMContentLoaded", function () {
  // Wait for Jotform to load
  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "string") return;

    try {
      const messageData = JSON.parse(event.data);

      // Check for submission data from Jotform
      if (messageData.type === "submission-completed") {
        const submissionData = messageData.data;

        // Customize this based on actual field names from Jotform
        const taskData = {
          userId: firebase.auth().currentUser ? firebase.auth().currentUser.uid : "anonymous",
          email: firebase.auth().currentUser ? firebase.auth().currentUser.email : "unknown",
          submittedAt: new Date(),
          formId: submissionData.formID,
          submissionId: submissionData.submissionID,
          answers: submissionData.answers
        };

        // Save to Firestore
        firebase.firestore().collection("submittedTasks").add(taskData)
          .then(() => {
            console.log("Jotform submission saved to Firebase");
          })
          .catch((error) => {
            console.error("Error saving submission to Firebase:", error);
          });
      }
    } catch (err) {
      // Ignore non-JSON messages
    }
  });
});

});

// Button click handlers
function submitTasks() {
  const jotFormUrl = "https://form.jotform.com/1234567890?userId=UID&email=email@example.com";
  window.open(jotFormUrl, '_blank');
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



  