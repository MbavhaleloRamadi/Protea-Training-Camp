// Enhanced calendar functionality with clickable double points highlights and animations
function renderCalendar(containerId, year, month, highlights) {
    const container = document.getElementById(containerId);
    const monthNames = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Create month navigation with animated transitions
    let html = `
        <div class="month-navigation">
            <button class="month-nav-btn prev-month animate-pulse">&lt;</button>
            <span class="current-month animate-fade-in">${monthNames[month]} ${year}</span>
            <button class="month-nav-btn next-month animate-pulse">&gt;</button>
        </div>
        
        <div class="calendar-day-names animate-slide-in">
            <div class="day-name">Sun</div>
            <div class="day-name">Mon</div>
            <div class="day-name">Tue</div>
            <div class="day-name">Wed</div>
            <div class="day-name">Thu</div>
            <div class="day-name">Fri</div>
            <div class="day-name">Sat</div>
        </div>
        
        <div class="calendar-grid animate-fade-in">`;
    
    // Add days from previous month
    for (let i = 0; i < firstDay; i++) {
        const prevDay = prevMonthDays - firstDay + i + 1;
        html += `<div class="calendar-day inactive-day">${prevDay}</div>`;
    }
    
    // Add days of current month with event highlights
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const key = `${month + 1}-${day}`;
        
        // Check for special events from original code
        const hasEvent = highlights[key] ? true : false;
        let eventClass = '';
        let tooltipText = '';
        
        // Determine event type based on color from original code
        if (hasEvent) {
            switch(highlights[key]) {
                case '#ffff00':
                    eventClass = 'event-tournament';
                    tooltipText = 'Tournament Event';
                    break;
                case '#ff9900':
                    eventClass = 'event-training';
                    tooltipText = 'Training Session';
                    break;
                case '#ff0000':
                    eventClass = 'event-special';
                    tooltipText = 'Special Event';
                    break;
                default:
                    eventClass = 'event-free';
                    tooltipText = 'Free Play';
            }
        }
        
        // Special event descriptions from original code
        if (month === 6 && day === 14) tooltipText = 'Trophy Weekly Tour Begins';
        if (month === 8 && day === 12) tooltipText = 'Quiz Night Break';
        
        // Tuesday events (Training) from original code
        if ((day + firstDay - 1) % 7 === 2) {
            if (!eventClass) {
                eventClass = 'event-free';
                tooltipText = 'Free 9 Holes';
            }
        }
        
        // Check for double points periods
        let doublePointsCategory = getDoublePointsCategory(currentDate);
        let clickableClass = '';
        let clickableAttr = '';
        let doublePointsMessage = '';
        
        if (doublePointsCategory) {
            // Add double points class while preserving other event classes
            eventClass += ' double-points-' + doublePointsCategory.toLowerCase().replace(' ', '-');
            clickableClass = 'clickable-double-points animate-sparkle';
            
            // Create clickable attribute and message
            doublePointsMessage = `If you log a practice under ${doublePointsCategory} category, you'll get DOUBLE POINTS for the entire period!`;
            clickableAttr = `data-double-points-message="${doublePointsMessage}" data-category="${doublePointsCategory}"`;
            
            // Add or append to tooltip
            if (tooltipText) {
                tooltipText += ` + Double Points: ${doublePointsCategory}`;
            } else {
                tooltipText = `Double Points: ${doublePointsCategory}`;
            }
        }
        
        // Check for tournament days
        if (isTournamentDay(currentDate)) {
            eventClass = 'event-tournament';
            tooltipText = 'Tournament Day';
        }
        
        // Add the day cell with appropriate classes and tooltip
        html += `<div class="calendar-day ${eventClass} ${hasEvent || eventClass ? 'has-event' : ''} ${clickableClass}" ${clickableAttr}>
            ${day}
            ${tooltipText ? `<span class="event-tooltip">${tooltipText}</span>` : ''}
        </div>`;
    }
    
    // Add days from next month to complete the grid
    const totalDaysShown = firstDay + daysInMonth;
    const nextMonthDays = 42 - totalDaysShown > 7 ? 7 - (totalDaysShown % 7) : 42 - totalDaysShown;
    
    for (let i = 1; i <= nextMonthDays; i++) {
        html += `<div class="calendar-day inactive-day">${i}</div>`;
    }
    
    html += `</div>
    
    <div class="double-points-popup" id="double-points-popup">
        <div class="popup-content animate-pop-in">
            <div class="popup-close">&times;</div>
            <h3 class="popup-title">Double Points Period!</h3>
            <div class="popup-category">Category: <span id="popup-category"></span></div>
            <p id="popup-message"></p>
            <div class="popup-icon"></div>
            <button class="popup-close-btn">Close</button>
        </div>
    </div>
    
    <div class="event-legend animate-slide-in">
        <h3 class="legend-title">Calendar Legend</h3>
        <div class="legend-item">
            <span class="legend-color legend-tournament animate-pulse"></span>
            <span>Putting (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-training animate-pulse"></span>
            <span>Chipping (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-free animate-pulse"></span>
            <span>Irons (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-special animate-pulse"></span>
            <span>Mental (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-tour-prep animate-pulse"></span>
            <span>Tour Prep (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-fitness animate-pulse"></span>
            <span>Fitness (Double Points)</span>
        </div>
    </div>`;
    
    container.innerHTML = html;
    
    // Add event listeners for month navigation
    const prevBtn = container.querySelector('.prev-month');
    const nextBtn = container.querySelector('.next-month');
    
    prevBtn.addEventListener('click', function() {
        let newMonth = month - 1;
        let newYear = year;
        
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        }
        
        // Only allow navigation between July-September 2025
        if (newYear === 2025 && newMonth >= 6 && newMonth <= 8) {
            // Add exit animation to current month
            container.classList.add('animate-exit');
            
            // After exit animation completes, load new month
            setTimeout(() => {
                const newHighlights = getHighlightsForMonth(newMonth);
                renderCalendar(containerId, newYear, newMonth, newHighlights);
                container.classList.remove('animate-exit');
                container.classList.add('animate-enter');
                setTimeout(() => container.classList.remove('animate-enter'), 500);
            }, 300);
        }
    });
    
    nextBtn.addEventListener('click', function() {
        let newMonth = month + 1;
        let newYear = year;
        
        if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        
        // Only allow navigation between July-September 2025
        if (newYear === 2025 && newMonth >= 6 && newMonth <= 8) {
            // Add exit animation to current month
            container.classList.add('animate-exit');
            
            // After exit animation completes, load new month
            setTimeout(() => {
                const newHighlights = getHighlightsForMonth(newMonth);
                renderCalendar(containerId, newYear, newMonth, newHighlights);
                container.classList.remove('animate-exit');
                container.classList.add('animate-enter');
                setTimeout(() => container.classList.remove('animate-enter'), 500);
            }, 300);
        }
    });
    
    // Add click listeners to ONLY double points days
    const doublePointsDays = container.querySelectorAll('.clickable-double-points');
    const popup = document.getElementById('double-points-popup');
    const popupMessage = document.getElementById('popup-message');
    const popupCategory = document.getElementById('popup-category');
    const popupClose = popup.querySelector('.popup-close');
    const popupCloseBtn = popup.querySelector('.popup-close-btn');
    
    doublePointsDays.forEach(day => {
        day.addEventListener('click', function() {
            const message = this.getAttribute('data-double-points-message');
            const category = this.getAttribute('data-category');
            
            // Set popup content
            popupMessage.textContent = message;
            popupCategory.textContent = category;
            
            // Set popup icon class based on category
            const popupIcon = popup.querySelector('.popup-icon');
            popupIcon.className = 'popup-icon';
            popupIcon.classList.add('icon-' + category.toLowerCase().replace(' ', '-'));
            
            // Show popup with animation
            popup.style.display = 'flex'; // Ensure it's displayed as flex first
            popup.classList.add('show-popup');
            
            // Add targeted animation to the clicked day
            this.classList.add('day-highlight-pulse');
            setTimeout(() => this.classList.remove('day-highlight-pulse'), 2000);
        });
    });
    
    // Close popup when clicking the close button (X)
    popupClose.addEventListener('click', function() {
        popup.classList.remove('show-popup');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300); // Wait for animation to complete
    });
    
    // Close popup when clicking the Close button
    popupCloseBtn.addEventListener('click', function() {
        popup.classList.remove('show-popup');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300); // Wait for animation to complete
    });
    
    // Close popup when clicking outside
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            popup.classList.remove('show-popup');
            setTimeout(() => {
                popup.style.display = 'none';
            }, 300); // Wait for animation to complete
        }
    });
}

// Function to determine double points category for a given date
function getDoublePointsCategory(date) {
    // Format date to simple string for comparison
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const day = date.getDate();
    
    // Putting double points periods
    if ((year === 2025 && month === 7 && day >= 1 && day <= 6) || 
        (year === 2025 && month === 8 && day >= 11 && day <= 17)) {
        return "Putting";
    }
    
    // Chipping double points periods
    if ((year === 2025 && month === 7 && day >= 7 && day <= 13) || 
        (year === 2025 && month === 8 && day >= 18 && day <= 24)) {
        return "Chipping";
    }
    
    // Irons double points periods
    if ((year === 2025 && month === 7 && day >= 14 && day <= 20) || 
        (year === 2025 && month === 8 && day >= 4 && day <= 10)) {
        return "Irons";
    }
    
    // Tour Prep double points periods
    if ((year === 2025 && month === 7 && day >= 21 && day <= 27) || 
        (year === 2025 && month === 9 && day >= 15 && day <= 23)) {
        return "Tour Prep";
    }
    
    // Mental double points periods
    if ((year === 2025 && month === 7 && day >= 28 && day <= 31) || 
        (year === 2025 && month === 8 && day >= 1 && day <= 3) || 
        (year === 2025 && month === 8 && day >= 8 && day <= 14)) {
        return "Mental";
    }
    
    // Fitness double points periods
    if (year === 2025 && month === 8 && day >= 25 && day <= 31) {
        return "Fitness";
    }
    
    // No double points for this date
    return null;
}

// Function to check if a date is a tournament day
function isTournamentDay(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Tournament days: September 24-28, 2025
    return (year === 2025 && month === 9 && day >= 24 && day <= 28);
}

function getHighlightsForMonth(month) {
    // Return the highlights for each month (using your original values)
    switch(month) {
        case 6: // July
            return {
                "7-4": "#ffff00", "7-11": "#ff9900", "7-18": "#ff9900", "7-25": "#ff9900",
                "7-14": "#ffff00", "7-20": "#ffff00"
            };
        case 7: // August
            return {
                "8-1": "#ff9900", "8-8": "#ff9900", "8-15": "#ff9900", "8-22": "#ff9900",
                "8-29": "#ff9900"
            };
        case 8: // September
            return {
                "9-5": "#ff9900", "9-12": "#ff0000", "9-19": "#ff9900"
            };
        default:
            return {};
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the calendar with July 2025
    renderCalendar('calendar-container', 2025, 6, getHighlightsForMonth(6));
    
    // Set up back to dashboard button with animation
    const backButton = document.querySelector('.back-button');
    backButton.classList.add('animate-float');
    backButton.addEventListener('click', function() {
        window.location.href = "dashboard.html";
    });
    
    // Add animated intro effect
    const calendarContainer = document.getElementById('calendar-container');
    calendarContainer.classList.add('animate-intro');
    setTimeout(() => calendarContainer.classList.remove('animate-intro'), 1000);
    
    // Add confetti effect for special dates
    setupConfettiEffect();
});