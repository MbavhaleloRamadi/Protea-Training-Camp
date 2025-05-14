// Enhanced calendar functionality with double points highlights
function renderCalendar(containerId, year, month, highlights) {
    const container = document.getElementById(containerId);
    const monthNames = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    // Create month navigation
    let html = `
        <div class="month-navigation">
            <button class="month-nav-btn prev-month">&lt;</button>
            <span class="current-month">${monthNames[month]} ${year}</span>
            <button class="month-nav-btn next-month">&gt;</button>
        </div>
        
        <div class="calendar-day-names">
            <div class="day-name">Sun</div>
            <div class="day-name">Mon</div>
            <div class="day-name">Tue</div>
            <div class="day-name">Wed</div>
            <div class="day-name">Thu</div>
            <div class="day-name">Fri</div>
            <div class="day-name">Sat</div>
        </div>
        
        <div class="calendar-grid">`;
    
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
                eventClass = 'event-training';
                tooltipText = 'Driving Range Games - Irons only';
            }
        }
        
        // Wednesday events (Free Play) from original code
        if ((day + firstDay - 1) % 7 === 3) {
            if (!eventClass) {
                eventClass = 'event-free';
                tooltipText = 'Free 9 Holes';
            }
        }
        
        // NEW: Check for double points periods
        let doublePointsCategory = getDoublePointsCategory(currentDate);
        if (doublePointsCategory) {
            // Add double points class while preserving other event classes
            eventClass += ' double-points-' + doublePointsCategory.toLowerCase().replace(' ', '-');
            
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
        html += `<div class="calendar-day ${eventClass} ${hasEvent || eventClass ? 'has-event' : ''}">
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
    
    <div class="event-legend">
        <div class="legend-item">
            <span class="legend-color legend-tournament"></span>
            <span>Putting (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-training"></span>
            <span>Chipping (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-free"></span>
            <span>Irons (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-special"></span>
            <span>Mental (Double Points)</span>
        </div>
        <div class="legend-item">
            <span class="legend-color legend-double-points"></span>
            <span>Double Points Colours</span>
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
            const newHighlights = getHighlightsForMonth(newMonth);
            renderCalendar(containerId, newYear, newMonth, newHighlights);
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
            const newHighlights = getHighlightsForMonth(newMonth);
            renderCalendar(containerId, newYear, newMonth, newHighlights);
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
    
    // Set up back to dashboard button
    document.querySelector('.back-button').addEventListener('click', function() {
        window.location.href = "dashboard.html";
    });
});