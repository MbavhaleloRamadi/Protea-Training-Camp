// Combined JavaScript Authentication Implementation

document.addEventListener("DOMContentLoaded", () => {
  // Global variables
  let messageTimeout;

  // ───────────────────────────────────────────────────────────
  // UI ELEMENTS
  // ───────────────────────────────────────────────────────────
  const elements = {
    // Loader elements  
    loader: document.querySelector(".loader-overlay"),
    loaderSpinner: document.getElementById("loader"),
    
    // Auth elements
    registerForm: document.getElementById("registerForm"),
    registerName: document.getElementById("registerName"),
    registerEmail: document.getElementById("registerEmail"),
    registerPassword: document.getElementById("registerPassword"),
    registerUsername: document.getElementById("registerUsername"),
    loginForm: document.getElementById("loginForm"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    loginEmail: document.getElementById("loginEmail"),
    
    // Message container
    confirmEl: document.getElementById("confirmationMessage"),
    
    // Calendar containers
    july: document.getElementById("julyCalendar"),
    august: document.getElementById("augustCalendar"),
    september: document.getElementById("septemberCalendar")
  };

  // ───────────────────────────────────────────────────────────
  // PAGE LOADER
  // ───────────────────────────────────────────────────────────
  if (elements.loader) {
    window.addEventListener("load", () => {
      elements.loader.style.transition = "opacity 0.6s ease";
      elements.loader.style.opacity = "0";
      setTimeout(() => {
        elements.loader.style.display = "none";
        document.body.style.visibility = "visible";
      }, 600);
    });
  } else {
    // Use spinner loader fallback if overlay loader not available
    setTimeout(() => {
      showLoading(false);
    }, 2000);
  }

  // ───────────────────────────────────────────────────────────
  // FIREBASE INITIALIZATION
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

  let auth, dbFirestore, dbRealtime;

  try {
    if (window.firebase) {
      firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      dbFirestore = firebase.firestore();
      dbRealtime = firebase.database();

      auth.onAuthStateChanged(user => {
        console.log(user ? "User is logged in" : "User is not logged in");
      });
    } else {
      console.error("Firebase SDK not found.");
      return;
    }
  } catch (error) {
    console.error("Firebase init error:", error);
    showMessage("Init error. Try refresh.", "red");
    return;
  }

  // ───────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ───────────────────────────────────────────────────────────
  
  // Function to show/hide loading state
  function showLoading(isLoading) {
    // First try the spinner loader
    if (elements.loaderSpinner) {
      elements.loaderSpinner.style.display = isLoading ? 'flex' : 'none';
    }
    // Also handle overlay loader if available
    if (elements.loader) {
      elements.loader.style.display = isLoading ? 'flex' : 'none';
    }
  }

  // Function to show status messages
  function showMessage(message, color = "green") {
    // First check if we have the dedicated confirmation element
    if (elements.confirmEl) {
      elements.confirmEl.textContent = message;
      elements.confirmEl.style.color = color;
      elements.confirmEl.style.backgroundColor =
        color === "green" ? "rgba(40,167,69,0.2)" :
        color === "red" ? "rgba(220,53,69,0.2)" :
        "rgba(255,193,7,0.2)";
      elements.confirmEl.classList.remove("hidden");
      if (color !== "red") {
        setTimeout(() => elements.confirmEl.classList.add("hidden"), 5000);
      }
      return;
    }
    
    // Fallback to floating message if no confirmation element
    // Clear any existing timeout
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }
    
    // Get or create message container
    let messageContainer = document.getElementById('messageContainer');
    
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'messageContainer';
      messageContainer.style.position = 'fixed';
      messageContainer.style.top = '20px';
      messageContainer.style.left = '50%';
      messageContainer.style.transform = 'translateX(-50%)';
      messageContainer.style.padding = '12px 24px';
      messageContainer.style.borderRadius = '4px';
      messageContainer.style.fontWeight = 'bold';
      messageContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      messageContainer.style.zIndex = '2000';
      messageContainer.style.transition = 'opacity 0.3s ease';
      document.body.appendChild(messageContainer);
    }
    
    // Set the message and color
    messageContainer.textContent = message;
    messageContainer.style.backgroundColor = color === "green" ? "#4CAF50" : color === "red" ? "#F44336" : "#FFC107";
    messageContainer.style.color = "white";
    messageContainer.style.opacity = '1';
    
    // Hide after 3 seconds
    messageTimeout = setTimeout(() => {
      messageContainer.style.opacity = '0';
    }, 3000);
  }

  // ───────────────────────────────────────────────────────────
  // REGISTRATION FLOW
  // ───────────────────────────────────────────────────────────
  if (elements.registerForm) {
    elements.registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showLoading(true);

      const name = elements.registerName?.value?.trim() || "";
      const username = elements.registerUsername?.value?.trim() || "";
      const email = elements.registerEmail?.value?.trim() || "";
      const password = elements.registerPassword?.value || "";

      if (!name || !username || !email || !password) {
        showLoading(false);
        return showMessage("Please fill in all fields.", "red");
      }

      if (password.length < 6) {
        showLoading(false);
        return showMessage("Password must be at least 6 characters.", "red");
      }

      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        showLoading(false);
        return showMessage("Username must be alphanumeric/underscore.", "red");
      }

      try {
        const usernameQuery = await dbFirestore.collection("usernames").doc(username).get();
        if (usernameQuery.exists) {
          showLoading(false);
          return showMessage("Username taken.", "red");
        }

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const uid = user.uid;
        const createdAt = new Date().toISOString();

        const userData = {
          fullName: name,
          username,
          email,
          createdAt,
          uid
        };

        const batch = dbFirestore.batch();
        batch.set(dbFirestore.collection("users").doc(uid), userData);
        batch.set(dbFirestore.collection("usernames").doc(username), {
          uid,
          email,
          createdAt
        });

        await batch.commit();
        await dbRealtime.ref("users/" + uid).set(userData);
        await dbRealtime.ref("usernames/" + username).set({
          uid,
          email
        });

        showLoading(false);
        showMessage("Registration successful!", "green");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      } catch (err) {
        console.error("Registration error:", err);
        showLoading(false);
        showMessage(`Failed: ${err.message}`, "red");
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // LOGIN FLOW
  // ───────────────────────────────────────────────────────────
  if (elements.loginForm) {
    elements.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showLoading(true);

      const username = elements.loginUsername?.value?.trim() || "";
      const password = elements.loginPassword?.value || "";

      if (!username || !password) {
        showLoading(false);
        return showMessage("Missing username/password", "red");
      }

      try {
        let userEmail = null;
        const usernameSnapshot = await dbRealtime.ref(`usernames/${username}`).once("value");

        if (usernameSnapshot.exists()) {
          userEmail = usernameSnapshot.val().email;
        } else {
          const usernameDoc = await dbFirestore.collection("usernames").doc(username).get();
          if (usernameDoc.exists) {
            userEmail = usernameDoc.data().email;
          } else {
            showLoading(false);
            return showMessage("Username not found.", "red");
          }
        }

        await auth.signInWithEmailAndPassword(userEmail, password);
        showLoading(false);
        showMessage("Login successful!", "green");

        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1000);
      } catch (err) {
        console.error("Login error:", err);
        showLoading(false);
        const msg = err.code === "auth/wrong-password"
          ? "Incorrect password."
          : err.code === "auth/user-not-found"
          ? "User not found."
          : `Error: ${err.message}`;
        showMessage(msg, "red");
      }
    });
  }

  // ───────────────────────────────────────────────────────────
  // CALENDAR RENDERING
  // ───────────────────────────────────────────────────────────
  function renderCalendar(container, month, year, highlights = {}) {
    if (!container) return;
    
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const date = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const startDay = date.getDay();
    let html = `<table class="calendar"><thead><tr>${days.map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody><tr>`;
    let dayCount = 0;

    for (let i = 0; i < startDay; i++) {
      html += "<td></td>";
      dayCount++;
    }

    for (let day = 1; day <= lastDay; day++) {
      const dateKey = `${month}-${day}`;
      const className = highlights[dateKey] ? `highlight ${highlights[dateKey]}` : "";
      html += `<td class="${className}">${day}</td>`;
      dayCount++;
      if (dayCount % 7 === 0) html += "</tr><tr>";
    }

    html += "</tr></tbody></table>";
    container.innerHTML = html;
  }

  const highlightJuly = {
    "11": "brown", "14": "yellow", "18": "brown", "21": "brown", "25": "brown", "28": "brown"
  };
  const highlightAugust = {
    "1": "brown", "4": "brown", "8": "brown", "11": "brown", "15": "brown", "18": "brown", "22": "brown", "25": "brown", "29": "brown"
  };
  const highlightSeptember = {
    "1": "brown", "5": "brown", "8": "brown", "12": "red", "15": "brown", "19": "brown", "22": "brown", "26": "brown"
  };

  if (elements.july) renderCalendar(elements.july, 7, 2025, highlightJuly);
  if (elements.august) renderCalendar(elements.august, 8, 2025, highlightAugust);
  if (elements.september) renderCalendar(elements.september, 9, 2025, highlightSeptember);
});

// ───────────────────────────────────────────────────────────
// Transition Animations + Navigation
// ───────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-loaded');
});

const addExitAnimation = () => {
  document.body.classList.remove('page-loaded');
  document.body.classList.add('page-exit');
};

document.querySelectorAll('a[href]').forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');
    if (!href.startsWith('#') && !href.startsWith('javascript:')) {
      e.preventDefault();
      addExitAnimation();
      setTimeout(() => {
        window.location.href = href;
      }, 500);
    }
  });
});

window.addEventListener('beforeunload', addExitAnimation);

// Additional Navigation Bindings
function submitTasks() { window.location.href = "submit-task.html"; }
function viewLeaderboard() { window.location.href = "leaderboard.html"; }
function viewHistory() { window.location.href = "history.html"; }
function manageTasks() { window.location.href = "manage-tasks.html"; }