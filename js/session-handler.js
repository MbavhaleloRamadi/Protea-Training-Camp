// session-handler.js

document.addEventListener('DOMContentLoaded', () => {
    // Firebase must be initialized before this script runs.
    // Assuming firebase.app(), firebase.auth() are globally available.
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error("Firebase SDK or Auth not found. Auto-logout will not function.");
        return;
    }

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
    let lastActivityTime = Date.now();
    let inactivityTimer;

    // Function to reset the inactivity timer
    function resetInactivityTimer() {
        lastActivityTime = Date.now();
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);
        // console.log("Activity detected, timer reset."); // For debugging
    }

    // Function to check for inactivity and log out if needed
    function checkInactivity() {
        const currentTime = Date.now();
        if (currentTime - lastActivityTime >= INACTIVITY_TIMEOUT_MS) {
            console.warn("User inactive for too long. Logging out...");
            firebase.auth().signOut()
                .then(() => {
                    // Store a flag in session storage to indicate auto-logout
                    sessionStorage.setItem('autoLogout', 'true');
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    console.error("Error during auto-logout:", error);
                    alert("An error occurred during auto-logout. Please refresh.");
                });
        }
    }

    // Attach event listeners to reset the timer on user activity
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(eventType => {
        document.addEventListener(eventType, resetInactivityTimer, { passive: true });
    });

    // Initialize the timer when the page loads
    resetInactivityTimer();

    // Check if auto-logout occurred on the previous page and display a message
    if (sessionStorage.getItem('autoLogout') === 'true') {
        sessionStorage.removeItem('autoLogout'); // Clear the flag
        // Ensure the message display function exists (from scripts.js or submit-task.js)
        if (typeof showMessage === 'function') {
            showMessage("You were logged out due to inactivity.", "red");
        } else if (typeof showConfirmation === 'function') {
            showConfirmation("You were logged out due to inactivity.", "red");
        } else {
            alert("You were logged out due to inactivity.");
        }
    }

    // Optional: Add a listener for auth state changes to re-init timer on login/logout events
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log("User logged in. Auto-logout timer active.");
            resetInactivityTimer(); // Start/reset timer for the logged-in user
        } else {
            console.log("User logged out. Stopping auto-logout timer.");
            clearTimeout(inactivityTimer); // Stop timer if no user is logged in
        }
    });

});