// Description: This script handles the loading animation and form submission for login and registration.
document.addEventListener("DOMContentLoaded", function () {
  
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
  
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Logged in! (Functionality to be implemented with Firebase)");
      });
    }
  
    if (registerForm) {
      registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Registered! (Functionality to be implemented with Firebase)");
      });
    }
  });

  window.addEventListener("load", () => {
    const loader = document.getElementById("loader");
  
    if (loader) {
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.6s ease";
  
      setTimeout(() => {
        loader.style.display = "none";
        document.body.style.visibility = "visible";
      }, 600); // matches the CSS fade-out duration
    }
  });
  
  