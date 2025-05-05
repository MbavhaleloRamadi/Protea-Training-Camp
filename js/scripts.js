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
      storageBucket: "protea-training-camp.firebasestorage.app",
      messagingSenderId: "649833361697",
      appId: "1:649833361697:web:5c402a67872ca10fe30e60",
      measurementId: "G-K1HKHPG6HG"
    };
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
  
    // Register Form Logic
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", function (e) {
        e.preventDefault(); // Prevent the page reload
        const name = document.getElementById("registerName").value;
        const email = document.getElementById("registerEmail").value;
        const password = document.getElementById("registerPassword").value;
  
        firebase.auth().createUserWithEmailAndPassword(email, password)
          .then(() => {
            alert("Registration successful!");
            window.location.href = "login.html"; // Redirect to login page
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
        e.preventDefault(); // Prevent the page reload
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
  
        firebase.auth().signInWithEmailAndPassword(email, password)
          .then(() => {
            window.location.href = "leaderboard.html"; // Redirect to leaderboard page
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
  
    // Monitor Auth State Changes
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        console.log("User is logged in");
      } else {
        console.log("User is not logged in");
      }
    });
  });
  
  // Assuming existing Firebase initialization and other functionality are already in place

document.addEventListener("DOMContentLoaded", function () {
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

    // Firebase Firestore connection to get leaderboard data
    const db = firebase.firestore();
    const leaderboardRef = db.collection("leaderboard").orderBy("score", "desc").limit(10);
    
    leaderboardRef.get().then((querySnapshot) => {
        const leaderboardDataContainer = document.getElementById("leaderboardData");
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const playerRow = document.createElement("div");
            playerRow.classList.add("leaderboard-row");
            
            const rank = document.createElement("div");
            rank.classList.add("rank");
            rank.textContent = data.rank;

            const name = document.createElement("div");
            name.classList.add("name");
            name.textContent = data.name;

            const score = document.createElement("div");
            score.classList.add("score");
            score.textContent = data.score;

            playerRow.append(rank, name, score);
            leaderboardDataContainer.appendChild(playerRow);
        });
    }).catch((error) => {
        console.error("Error fetching leaderboard data: ", error);
    });
});

  