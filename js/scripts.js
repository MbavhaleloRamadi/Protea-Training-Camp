// Wait for the DOM to load completely
document.addEventListener("DOMContentLoaded", function() {
    
    // Hide the loader after the page has fully loaded
    window.onload = function() {
        const loader = document.querySelector('.loader');
        loader.style.display = 'none';  // Hide the loader when the page is ready
    };

    // Example for any button interactivity (for future features)
    const primaryBtn = document.querySelector('.primary-btn');
    const secondaryBtn = document.querySelector('.secondary-btn');

    // Add functionality for buttons (for example, simple logging or navigation)
    primaryBtn.addEventListener('click', function() {
        console.log('Register button clicked');
        // You can replace this with a real navigation or registration form
    });

    secondaryBtn.addEventListener('click', function() {
        console.log('Login button clicked');
        // You can replace this with a real navigation to the login page
    });

});
