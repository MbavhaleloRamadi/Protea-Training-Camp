// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCLFOHGb5xaMSUtE_vgVO0aaY6MfLySeTs",
  authDomain: "protea-training-camp.firebaseapp.com",
  projectId: "protea-training-camp",
  storageBucket: "protea-training-camp.appspot.com",
  messagingSenderId: "649833361697",
  appId: "1:649833361697:web:5c402a67872ca10fe30e60",
  measurementId: "G-K1HKHPG6HG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const dbFirestore = getFirestore(app);
const dbRealtime = getDatabase(app);

// DOM references
const submitForm = document.getElementById("submitTaskForm");
const submitBtn = document.getElementById("submitBtn");
const taskCategory = document.getElementById("taskCategory");
const practiceContainer = document.getElementById("practiceContainer");
const practiceList = document.getElementById("practiceList");
const selectedLabel = document.getElementById("selectedLabel");
const selectedList = document.getElementById("selectedList");
const confirmEl = document.getElementById("confirmationMessage");

// Practices data (shortened here for brevity — paste full object from your code)
const practicesData = {
  "Putting": [
    { name: "Putt-50/1", description: "Putt 50 Balls longer than 1 Metre", points: 1 },
    { name: "Putt-Drain20/1", description: "Drain 20 Consecutive Putts Longer than 1 Metre", points: 1 }
  ],
  // Add rest of your categories...
};

// State
let selectedPractices = [];

// Show confirmation
function showConfirmation(msg, color) {
  confirmEl.textContent = msg;
  confirmEl.style.color = color;
  confirmEl.style.backgroundColor = color === "green"
    ? "rgba(40,167,69,0.2)"
    : "rgba(220,53,69,0.2)";
  confirmEl.classList.remove("hidden");
}

// Render selected list
function renderSelected() {
  selectedList.innerHTML = "";
  selectedPractices.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = `${p.name} (${p.points} pts)`;
    li.style.cursor = "pointer";
    li.title = "Click to remove";
    li.addEventListener("click", () => {
      selectedPractices.splice(i, 1);
      renderSelected();
    });
    selectedList.appendChild(li);
  });
  selectedLabel.textContent = `Selected Practices (${selectedPractices.length}/3)`;
}

// Handle category change
taskCategory.addEventListener("change", () => {
  const category = taskCategory.value;
  practiceList.innerHTML = "";
  selectedPractices = [];
  renderSelected();

  if (!practicesData[category]) {
    practiceContainer.classList.add("hidden");
    return;
  }

  practiceContainer.classList.remove("hidden");

  practicesData[category].forEach(practice => {
    const card = document.createElement("div");
    card.className = "practice-card";
    card.innerHTML = `<h4>${practice.name}</h4><p>${practice.description}</p><small>Points: ${practice.points}</small>`;
    card.addEventListener("click", () => {
      if (selectedPractices.length >= 3) {
        showConfirmation("You can only select 3 practices.", "red");
        return;
      }
      if (selectedPractices.find(p => p.name === practice.name)) {
        showConfirmation("Practice already selected.", "red");
        return;
      }
      selectedPractices.push(practice);
      renderSelected();
      showConfirmation(`✅ Added "${practice.name}"`, "green");
    });
    practiceList.appendChild(card);
  });
});

// Handle submit
submitForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    showConfirmation("⚠️ You must be logged in to submit.", "red");
    return;
  }

  const name = document.getElementById("golferName").value.trim();
  const category = taskCategory.value;
  const date = new Date().toISOString().split("T")[0];
  const docId = `${user.uid}_${category}_${date}`.replace(/\s+/g, "_").toLowerCase();

  if (!category || selectedPractices.length === 0) {
    showConfirmation("⚠️ Select a category and at least one practice.", "red");
    return;
  }

  const docRef = doc(dbFirestore, `users/${user.uid}/task_submissions/${docId}`);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    showConfirmation("⛔ You already submitted this category today!", "red");
    return;
  }

  const payload = {
    golferName: name,
    category,
    date,
    practices: selectedPractices,
    timestamp: Date.now(),
  };

  try {
    submitBtn.disabled = true;
    await setDoc(docRef, payload);
    await set(ref(dbRealtime, `users/${user.uid}/task_submissions/${docId}`), payload);
    showConfirmation("✅ Task submitted successfully!", "green");
    selectedPractices = [];
    renderSelected();
    submitForm.reset();
    practiceContainer.classList.add("hidden");
  } catch (err) {
    console.error(err);
    showConfirmation("⚠️ Submission failed. Try again.", "red");
  } finally {
    setTimeout(() => (submitBtn.disabled = false), 3000);
  }
});

// Monitor auth state
onAuthStateChanged(auth, (user) => {
  console.log(user ? "✅ Logged in" : "⛔ Not logged in");
});
